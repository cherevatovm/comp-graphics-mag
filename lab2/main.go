package main

import (
	"fmt"
	"runtime"

	"github.com/cherevatovm/comp-graphics-mag/internal/scene"
	"github.com/go-gl/gl/all-core/gl"
	"github.com/go-gl/glfw/v3.3/glfw"
)

func init() {
	// This is needed to arrange that main() runs on main thread.
	// See documentation for functions that are only allowed to be called from the main thread.
	runtime.LockOSThread()
}

func initGL() error {
	if err := gl.Init(); err != nil {
		return err
	}

	version := gl.GoStr(gl.GetString(gl.VERSION))
	glsl := gl.GoStr(gl.GetString(gl.SHADING_LANGUAGE_VERSION))
	fmt.Println("\nOpenGL version", version, glsl)

	gl.Viewport(0, 0, scene.Width, scene.Height)
	gl.ClearColor(0.25, 0.25, 0.25, 1.0)
	gl.Enable(gl.DEPTH_TEST)

	return nil
}

func initGLFW() (window *glfw.Window, err error) {
	glfw.WindowHint(glfw.Resizable, glfw.True)
	glfw.WindowHint(glfw.ContextVersionMajor, 3)
	glfw.WindowHint(glfw.ContextVersionMinor, 3)
	glfw.WindowHint(glfw.OpenGLProfile, glfw.OpenGLCoreProfile)
	glfw.WindowHint(glfw.OpenGLForwardCompatible, gl.TRUE)

	window, err = glfw.CreateWindow(scene.Width, scene.Height, "Lab 2", nil, nil)
	if err != nil {
		return nil, err
	}

	window.MakeContextCurrent()
	err = initGL()
	if err != nil {
		return nil, err
	}

	return window, nil
}

func main() {
	//taskNum := 0
	//fmt.Println("Enter task number:")
	//fmt.Scan(&taskNum)

	err := glfw.Init()
	if err != nil {
		panic(err)
	}
	defer glfw.Terminate()

	window, err := initGLFW()
	if err != nil {
		panic(err)
	}
	window.MakeContextCurrent()

	//newFunc := scene.NewSceneOneShape
	//if taskNum == 3 {
	//newFunc = scene.NewScenePedestal
	//}

	sc, err := scene.NewSceneThreeCubes(window)
	if err != nil {
		panic(err)
	}
	defer sc.Release()

	//drawFunc := sc.DrawSceneOneShape
	//if taskNum == 3 {
	//drawFunc = sc.DrawScenePedestal
	//}

	window.SetCursorPosCallback(func(w *glfw.Window, posX float64, posY float64) {
		if sc.FirstMouse {
			sc.LastPosX = posX
			sc.LastPosY = posY
			sc.FirstMouse = false
		}
		offsetX := float32(posX - sc.LastPosX)
		offsetY := float32(sc.LastPosY - posY)

		sc.LastPosX = posX
		sc.LastPosY = posY

		sc.Camera.ProcessMouseMove(offsetX, offsetY)
	})

	window.SetScrollCallback(func(w *glfw.Window, offX float64, offY float64) {
		sc.Camera.ProcessMouseScroll(float32(offY))
	})

	window.SetFramebufferSizeCallback(func(w *glfw.Window, width int, height int) {
		if height == 0 {
			height = 1
		}
		gl.Viewport(0, 0, int32(width), int32(height))
		aspect := float32(width) / float32(height)
		sc.Camera.SetAspectRatio(aspect)
	})

	window.SetKeyCallback(func(w *glfw.Window, key glfw.Key,
		scancode int, action glfw.Action, mods glfw.ModifierKey) {
		if key == glfw.KeyEscape && action == glfw.Press {
			window.SetShouldClose(true)
		}

		if key == glfw.KeyTab && action == glfw.Press {
			current := w.GetInputMode(glfw.CursorMode)
			if current == glfw.CursorDisabled {
				w.SetInputMode(glfw.CursorMode, glfw.CursorNormal)
			} else {
				w.SetInputMode(glfw.CursorMode, glfw.CursorDisabled)
			}
		}
	})

	window.SetInputMode(glfw.CursorMode, glfw.CursorDisabled)

	for !window.ShouldClose() {
		sc.UpdateDeltaTime(float32(glfw.GetTime()))
		sc.ProcessInput()

		gl.Clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)

		sc.UpdateViewProjPos()
		//drawFunc()
		sc.DrawSceneFourCubes()

		glfw.PollEvents()
		window.SwapBuffers()
	}
}
