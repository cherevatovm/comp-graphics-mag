package scene

import (
	"github.com/cherevatovm/comp-graphics-mag/internal/camera"
	"github.com/cherevatovm/comp-graphics-mag/internal/mesh"
	"github.com/cherevatovm/comp-graphics-mag/internal/shader"
	"github.com/go-gl/glfw/v3.3/glfw"
	"github.com/go-gl/mathgl/mgl32"
)

const (
	Width  = 1200
	Height = 900
)

type Scene struct {
	Window     *glfw.Window
	Camera     *camera.Camera
	Mesh       *mesh.Mesh
	ShaderProg shader.ShaderProgram

	LastPosX, LastPosY float64
	FirstMouse         bool

	baseTransforms []mgl32.Mat4
	cubeAngles     []float32
	pedestalAngle  float32
	globalAngle    float32

	deltaTime, lastFrame float32
}

func NewScenePedestal(window *glfw.Window) (*Scene, error) {
	sc := &Scene{Window: window, baseTransforms: make([]mgl32.Mat4, 4), cubeAngles: make([]float32, 4),
		LastPosX: float64(Width) / 2, LastPosY: float64(Height) / 2, FirstMouse: true}

	shaderProg, err := shader.NewShaderProgram("assets/shaders/simple.vert", "assets/shaders/simple.frag")
	if err != nil {
		return nil, err
	}
	sc.ShaderProg = shaderProg

	m, err := mesh.LoadMeshFromOBJ("assets/models/cube.obj")
	if err != nil {
		return nil, err
	}
	sc.Mesh = m
	sc.getBaseTransformsForPedestal()

	sc.Camera = camera.NewCamera(mgl32.Vec3{0, 0, 3},
		-90, 0, 45, float32(Width)/Height, 3, 0.1)

	return sc, nil
}

func (sc *Scene) DrawScenePedestal() {
	sc.ShaderProg.Use()
	globalRotMatr := mgl32.HomogRotate3DY(sc.globalAngle)
	localRotMatr := mgl32.HomogRotate3DY(sc.pedestalAngle)
	pedestalCent := sc.calcPedestalCenter()

	toOrigin := mgl32.Translate3D(-pedestalCent[0], -pedestalCent[1], -pedestalCent[2])
	fromOrigin := mgl32.Translate3D(pedestalCent[0], pedestalCent[1], pedestalCent[2])
	pedestalTransform := globalRotMatr.Mul4(fromOrigin.Mul4(localRotMatr.Mul4(toOrigin)))

	sc.drawCube(0, pedestalTransform, mgl32.Vec3{1.0, 0.84, 0})
	sc.drawCube(1, pedestalTransform, mgl32.Vec3{1.0, 0.84, 0})
	sc.drawCube(2, pedestalTransform, mgl32.Vec3{0.8, 0.5, 0.2})
	sc.drawCube(3, pedestalTransform, mgl32.Vec3{0.7, 0.7, 0.7})
}

func (sc *Scene) ProcessInput() {
	if sc.Window.GetKey(glfw.KeyW) == glfw.Press {
		sc.Camera.ProcessKeyboard(camera.Forward, sc.deltaTime)
	}
	if sc.Window.GetKey(glfw.KeyS) == glfw.Press {
		sc.Camera.ProcessKeyboard(camera.Backward, sc.deltaTime)
	}
	if sc.Window.GetKey(glfw.KeyA) == glfw.Press {
		sc.Camera.ProcessKeyboard(camera.Left, sc.deltaTime)
	}
	if sc.Window.GetKey(glfw.KeyD) == glfw.Press {
		sc.Camera.ProcessKeyboard(camera.Right, sc.deltaTime)
	}

	if sc.Window.GetKey(glfw.Key1) == glfw.Press {
		sc.cubeAngles[0] += sc.deltaTime * 2.0
	}
	if sc.Window.GetKey(glfw.Key2) == glfw.Press {
		sc.cubeAngles[1] += sc.deltaTime * 2.0
	}
	if sc.Window.GetKey(glfw.Key3) == glfw.Press {
		sc.cubeAngles[2] += sc.deltaTime * 2.0
	}
	if sc.Window.GetKey(glfw.Key4) == glfw.Press {
		sc.cubeAngles[3] += sc.deltaTime * 2.0
	}

	if sc.Window.GetKey(glfw.KeyL) == glfw.Press {
		sc.pedestalAngle += sc.deltaTime * 1.5
	}
	if sc.Window.GetKey(glfw.KeyG) == glfw.Press {
		sc.globalAngle += sc.deltaTime * 1.0
	}
	if sc.Window.GetKey(glfw.KeyR) == glfw.Press {
		for i := range sc.cubeAngles {
			sc.cubeAngles[i] = 0
		}
		sc.pedestalAngle = 0
		sc.globalAngle = 0
	}
}

func (sc *Scene) UpdateViewProjPos() {
	sc.ShaderProg.SetUniformSqMatrFloat("transform.view", sc.Camera.GetViewMatrix())
	sc.ShaderProg.SetUniformSqMatrFloat("transform.projection", sc.Camera.GetProjectionMatrix())
	sc.ShaderProg.SetUniformFloat("view_pos", sc.Camera.Position[0],
		sc.Camera.Position[1], sc.Camera.Position[2])
}

func (sc *Scene) UpdateDeltaTime(currentFrame float32) {
	sc.deltaTime = currentFrame - sc.lastFrame
	sc.lastFrame = currentFrame
}

func (sc *Scene) Release() {
	if sc.Mesh != nil {
		sc.Mesh.DeleteBuffers()
	}
	sc.ShaderProg.Delete()
}

func (sc *Scene) getBaseTransformsForPedestal() {
	model := mgl32.Translate3D(2, 0, 0)
	sc.baseTransforms[0] = model

	model1 := model.Mul4(mgl32.Translate3D(0, 0.5, 0))
	sc.baseTransforms[1] = model1

	model2 := model.Mul4(mgl32.Translate3D(0.5, 0, 0))
	sc.baseTransforms[2] = model2

	model3 := model.Mul4(mgl32.Translate3D(-0.5, 0, 0))
	sc.baseTransforms[3] = model3

	for i := range 4 {
		sc.baseTransforms[i] = sc.baseTransforms[i].Mul4(mgl32.Scale3D(0.25, 0.25, 0.25))
	}
}

func (sc *Scene) drawCube(index int, pedestalTransform mgl32.Mat4, color mgl32.Vec3) {
	rotationMatr := mgl32.HomogRotate3DY(sc.cubeAngles[index])
	transform := pedestalTransform.Mul4(sc.baseTransforms[index].Mul4(rotationMatr))

	sc.ShaderProg.SetUniformFloat("const_color", color[0], color[1], color[2])
	sc.ShaderProg.SetUniformSqMatrFloat("transform.model", transform)

	sc.Mesh.Draw()
}

func (sc *Scene) calcPedestalCenter() mgl32.Vec3 {
	var center mgl32.Vec3
	for _, tr := range sc.baseTransforms {
		pos := tr.Col(3).Vec3()
		center = center.Add(pos)
	}
	return center.Mul(1.0 / 4.0)
}
