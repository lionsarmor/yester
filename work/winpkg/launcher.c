#define UNICODE
#define _UNICODE
#define WIN32_LEAN_AND_MEAN
#include <windows.h>
#include <wchar.h>
#include <stdio.h>

static wchar_t root[32768], exe_path[32768], app_path[32768], tcl[32768], tk[32768], command[32768];
static int fail(const wchar_t *detail) {
    MessageBoxW(NULL, detail, L"Retro Page", MB_OK | MB_ICONERROR);
    return 1;
}
int WINAPI wWinMain(HINSTANCE instance, HINSTANCE previous, PWSTR args, int show) {
    DWORD n = GetModuleFileNameW(NULL, root, sizeof root / sizeof *root);
    if (!n || n >= 16000) return fail(L"Extract Retro Page to a shorter folder path and launch it again.");
    wchar_t *slash = wcsrchr(root, L'\\');
    if (!slash) return fail(L"Unable to locate the Retro Page folder.");
    *slash = L'\0';
    swprintf(exe_path, 32768, L"%ls\\runtime\\pythonw.exe", root);
    swprintf(app_path, 32768, L"%ls\\studio\\app.py", root);
    swprintf(tcl, 32768, L"%ls\\runtime\\tcl\\tcl8.6", root);
    swprintf(tk, 32768, L"%ls\\runtime\\tcl\\tk8.6", root);
    if (GetFileAttributesW(app_path) == INVALID_FILE_ATTRIBUTES || GetFileAttributesW(exe_path) == INVALID_FILE_ATTRIBUTES) {
        return fail(L"Extract the entire Retro Page ZIP first. Keep Retro Page.exe beside the studio and runtime folders.");
    }
    SetEnvironmentVariableW(L"TCL_LIBRARY", tcl);
    SetEnvironmentVariableW(L"TK_LIBRARY", tk);
    size_t required = wcslen(exe_path) + wcslen(app_path) + wcslen(args) + 32;
    if (required >= 32768) return fail(L"The project or application path is too long for Windows.");
    swprintf(command, 32768, L"\"%ls\" -E -s -B \"%ls\" %ls", exe_path, app_path, args);
    STARTUPINFOW si = {0}; PROCESS_INFORMATION pi = {0}; si.cb = sizeof si;
    if (!CreateProcessW(exe_path, command, NULL, NULL, FALSE, 0, NULL, NULL, &si, &pi)) {
        return fail(L"Windows could not start the bundled Retro Page runtime.");
    }
    CloseHandle(pi.hThread);
    WaitForSingleObject(pi.hProcess, INFINITE);
    DWORD exit_code = 1;
    GetExitCodeProcess(pi.hProcess, &exit_code);
    CloseHandle(pi.hProcess);
    if (exit_code) return fail(L"Retro Page stopped unexpectedly. Please keep the ZIP for troubleshooting and reopen the application.");
    return 0;
}
