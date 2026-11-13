$ErrorActionPreference = 'Stop'
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
using System.Text;
public static class DesktopMonitor {
    [DllImport("user32.dll")] static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")] static extern IntPtr GetShellWindow();
    [DllImport("user32.dll")] static extern IntPtr GetAncestor(IntPtr hwnd, uint flags);
    [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr hwnd, out uint processId);
    [DllImport("user32.dll")] static extern short GetAsyncKeyState(int key);
    [DllImport("user32.dll", CharSet=CharSet.Unicode)]
    static extern int GetClassName(IntPtr hwnd, StringBuilder name, int max);

    private delegate bool EnumWindow(IntPtr hwnd, IntPtr data);
    [DllImport("user32.dll")] static extern bool EnumWindows(EnumWindow callback, IntPtr data);
    [DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr hwnd);
    [DllImport("user32.dll")] static extern IntPtr GetWindow(IntPtr hwnd, uint relation);
    [DllImport("user32.dll", CharSet=CharSet.Unicode)] static extern IntPtr FindWindowEx(IntPtr parent, IntPtr child, string kind, string name);
    [DllImport("user32.dll", EntryPoint="GetWindowLongW")] static extern int GetWindowLong(IntPtr hwnd, int index);
    [DllImport("user32.dll")] static extern bool SetWindowPos(IntPtr hwnd, IntPtr after, int x, int y, int cx, int cy, uint flags);

    [StructLayout(LayoutKind.Sequential)] struct Point { public int X, Y; }
    [StructLayout(LayoutKind.Sequential)] struct Rect { public int Left, Top, Right, Bottom; }
    [DllImport("user32.dll")] static extern bool GetCursorPos(out Point point);
    [DllImport("user32.dll")] static extern IntPtr WindowFromPoint(Point point);
    [DllImport("user32.dll")] static extern bool GetWindowRect(IntPtr hwnd, out Rect rect);
    [DllImport("user32.dll")] static extern bool IsIconic(IntPtr hwnd);
    [DllImport("dwmapi.dll")] static extern int DwmGetWindowAttribute(IntPtr hwnd, uint attr, out int value, int size);

    public static bool DesktopAtPointer(IntPtr rug) {
        Point p;
        if (!GetCursorPos(out p)) return false;
        IntPtr under = GetAncestor(WindowFromPoint(p), 2); // GA_ROOT
        if (under == rug) {
            // The rug can be the root while it owns the pointer. Inspect below it.
            under = GetWindow(rug, 2); // GW_HWNDNEXT
            int count = 0;
            while (under != IntPtr.Zero && count++ < 256) {
                Rect r; int cloaked;
                bool hiddenByDwm = DwmGetWindowAttribute(under, 14, out cloaked, 4) == 0 && cloaked != 0;
                if (IsWindowVisible(under) && !IsIconic(under) && !hiddenByDwm &&
                    (GetWindowLong(under, GWL_EXSTYLE) & 0x20) == 0 &&
                    GetWindowRect(under, out r) && p.X >= r.Left && p.X < r.Right && p.Y >= r.Top && p.Y < r.Bottom) break;
                under = GetWindow(under, 2);
            }
            if (count >= 256) return false;
        }
        if (under == IntPtr.Zero) return false;
        if (under == GetShellWindow()) return true;
        var name = new StringBuilder(64);
        GetClassName(under, name, name.Capacity);
        return name.ToString() == "Progman" || name.ToString() == "WorkerW";
    }

    private const uint GW_HWNDPREV = 3;
    private const int GWL_EXSTYLE = -20, WS_EX_TOPMOST = 0x00000008;
    private const uint SWP_NOSIZE = 0x0001, SWP_NOMOVE = 0x0002, SWP_NOACTIVATE = 0x0010,
        SWP_NOOWNERZORDER = 0x0200, SWP_ASYNCWINDOWPOS = 0x4000;

    public static void KeepAboveDesktop(IntPtr rug) {
        if (rug == IntPtr.Zero) return;
        // Electron owns the topmost band. Do not undo the user's layer selection.
        if ((GetWindowLong(rug, GWL_EXSTYLE) & WS_EX_TOPMOST) != 0) return;
        IntPtr shell = GetShellWindow();
        IntPtr desktop = IntPtr.Zero;
        EnumWindows(delegate(IntPtr window, IntPtr data) {
            if (!IsWindowVisible(window)) return true;
            if (window != shell) {
                if (FindWindowEx(window, IntPtr.Zero, "SHELLDLL_DefView", null) == IntPtr.Zero) return true;
                var name = new StringBuilder(64);
                GetClassName(window, name, name.Capacity);
                if (name.ToString() != "Progman" && name.ToString() != "WorkerW") return true;
            }
            desktop = window;
            return false;
        }, IntPtr.Zero);
        if (desktop == IntPtr.Zero) return;

        IntPtr above = GetWindow(desktop, GW_HWNDPREV);
        if (above == rug) return;
        // Stay just above Explorer, without joining the topmost band.
        if (above != IntPtr.Zero && (GetWindowLong(above, GWL_EXSTYLE) & WS_EX_TOPMOST) != 0) {
            above = IntPtr.Zero; // HWND_TOP in the non-topmost band
        }
        SetWindowPos(rug, above, 0, 0, 0, 0,
            SWP_NOSIZE | SWP_NOMOVE | SWP_NOACTIVATE | SWP_NOOWNERZORDER | SWP_ASYNCWINDOWPOS);
    }

    private static IntPtr previousWindow = IntPtr.Zero;
    private static string previousContext = "app";
    private static bool resetHeld = false;

    public static bool ConsumeReset(IntPtr rug) {
        bool held = (GetAsyncKeyState(0x11) & 0x8000) != 0 &&
            (GetAsyncKeyState(0x10) & 0x8000) != 0 &&
            (GetAsyncKeyState(0x52) & 0x8000) != 0 &&
            (GetAsyncKeyState(0x12) & 0x8000) == 0;
        bool pressed = held && !resetHeld;
        resetHeld = held;
        return pressed && (previousContext == "desktop" || DesktopAtPointer(rug));
    }

    public static string GetContext(uint appProcess) {
        IntPtr hwnd = GetForegroundWindow();
        if (hwnd != previousWindow) {
            previousWindow = hwnd;
            previousContext = Classify(hwnd, appProcess);
        }
        return previousContext;
    }
    public static bool CtrlDown() { return (GetAsyncKeyState(0x11) & 0x8000) != 0; }
    public static bool ShiftDown() { return (GetAsyncKeyState(0x10) & 0x8000) != 0; }
    public static bool AltDown() { return (GetAsyncKeyState(0x12) & 0x8000) != 0; }
    public static int Buttons() {
        // Physical button bits are sufficient: any external drag blocks acquisition.
        int mask = 0;
        int[] keys = { 0x01, 0x02, 0x04, 0x05, 0x06 };
        for (int i = 0; i < keys.Length; i++) if ((GetAsyncKeyState(keys[i]) & 0x8000) != 0) mask |= 1 << i;
        return mask;
    }

    private static string Classify(IntPtr hwnd, uint appProcess) {
        if (hwnd == IntPtr.Zero) return "app";
        if (hwnd == GetShellWindow()) return "desktop";
        var name = new StringBuilder(64);
        GetClassName(hwnd, name, name.Capacity);
        string kind = name.ToString();
        if (kind == "Progman" || kind == "WorkerW") return "desktop";

        uint processId;
        GetWindowThreadProcessId(hwnd, out processId);
        if (processId == appProcess) return "owned";
        IntPtr owner = GetAncestor(hwnd, 3);
        if (owner == IntPtr.Zero || owner == hwnd) return "app";
        GetWindowThreadProcessId(owner, out processId);
        return processId == appProcess ? "owned" : "app";
    }
}
'@
$appProcess = [uint32]$env:HYEONBIT_RUG_MONITOR_PID
$rugWindow = [IntPtr]::new([long]$env:HYEONBIT_RUG_HWND)
$clock = [Diagnostics.Stopwatch]::StartNew()
$nextLayerCheck = 0
$previous = ''
$nextHeartbeat = 0
while ($true) {
    $context = [DesktopMonitor]::GetContext($appProcess)
    $reset = [DesktopMonitor]::ConsumeReset($rugWindow)
    $state = @{ context = $context; ctrl = [DesktopMonitor]::CtrlDown(); alt = [DesktopMonitor]::AltDown(); shift = [DesktopMonitor]::ShiftDown(); buttons = [DesktopMonitor]::Buttons(); desktopAtPointer = [DesktopMonitor]::DesktopAtPointer($rugWindow); reset = $reset }
    $next = $context + ':' + $state.ctrl + ':' + $state.alt + ':' + $state.shift + ':' + $state.buttons + ':' + $state.desktopAtPointer + ':' + $reset
    if ($clock.ElapsedMilliseconds -ge $nextLayerCheck) {
        [DesktopMonitor]::KeepAboveDesktop($rugWindow)
        $nextLayerCheck = $clock.ElapsedMilliseconds + 120
    }
    if ($previous -ne $next -or $clock.ElapsedMilliseconds -ge $nextHeartbeat) {
        [Console]::WriteLine((ConvertTo-Json -InputObject $state -Compress))
        [Console]::Out.Flush()
        $previous = $next
        $nextHeartbeat = $clock.ElapsedMilliseconds + 250
    }
    Start-Sleep -Milliseconds 16
}
