//go:build !windows

package main

import "fmt"

// messageBox — заглушка для не-Windows: пишем в stdout.
func messageBox(text, caption string) {
	fmt.Println(caption + ": " + text)
}
