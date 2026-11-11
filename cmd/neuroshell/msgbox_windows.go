//go:build windows

package main

import (
	"syscall"
	"unsafe"
)

// messageBox — системное окно сообщения Windows (используется, когда exe
// собран с -H=windowsgui и консоли нет, а окно приложения открыть не удалось).
func messageBox(text, caption string) {
	defer func() { recover() }() // в служебных контекстах просто не показываем
	user32 := syscall.NewLazyDLL("user32.dll")
	mbox := user32.NewProc("MessageBoxW")
	t, err1 := syscall.UTF16PtrFromString(text)
	c, err2 := syscall.UTF16PtrFromString(caption)
	if err1 != nil || err2 != nil {
		return
	}
	mbox.Call(0, uintptr(unsafe.Pointer(t)), uintptr(unsafe.Pointer(c)), 0x40) // MB_ICONINFORMATION
}
