package scene

import (
	"math"

	"github.com/cherevatovm/comp-graphics-mag/internal/camera"
	"github.com/cherevatovm/comp-graphics-mag/internal/mesh"
	"github.com/cherevatovm/comp-graphics-mag/internal/shader"
	"github.com/go-gl/gl/all-core/gl"
	"github.com/go-gl/glfw/v3.3/glfw"
	"github.com/go-gl/mathgl/mgl32"
)

const (
	Width  = 1200
	Height = 900
)

type Scene struct {
	ShaderProgs   []shader.ShaderProgram
	curShaderProg *shader.ShaderProgram

	Meshes  []*mesh.Mesh
	curMesh *mesh.Mesh

	Window *glfw.Window
	Camera *camera.Camera

	LastPosX, LastPosY float64
	FirstMouse         bool

	mode, activeMeshInd int
	baseTransforms      []mgl32.Mat4
	dynTransforms       []mgl32.Mat4

	cubeAngles    []float32
	pedestalAngle float32
	globalAngle   float32

	deltaTime, lastFrame float32
}

func NewSceneOneShape(window *glfw.Window) (*Scene, error) {
	sc := &Scene{Window: window, LastPosX: float64(Width) / 2, LastPosY: float64(Height) / 2,
		FirstMouse: true, mode: 0, ShaderProgs: make([]shader.ShaderProgram, 2),
		Meshes: make([]*mesh.Mesh, 2), baseTransforms: make([]mgl32.Mat4, 2)}

	sc.baseTransforms[0] = mgl32.Ident4()
	sc.baseTransforms[1] = mgl32.Scale3D(0.5, 0.5, 0.5)

	shaderProg, err := shader.NewShaderProgram("assets/shaders/simple.vert", "assets/shaders/simple.frag")
	if err != nil {
		return nil, err
	}
	sc.ShaderProgs[0] = shaderProg
	sc.curShaderProg = &sc.ShaderProgs[0]
	sc.curShaderProg.Use()
	sc.curShaderProg.SetUniformFloat("const_color", 0.75, 0.0, 0.0)
	sc.curShaderProg.SetUniformSqMatrFloat("transform.model", sc.baseTransforms[0])
	gl.UseProgram(0)

	shaderProg, err = shader.NewShaderProgram("assets/shaders/simple.vert", "assets/shaders/stripes.frag")
	if err != nil {
		return nil, err
	}
	sc.ShaderProgs[1] = shaderProg
	sc.ShaderProgs[1].Use()
	sc.ShaderProgs[1].SetUniformSqMatrFloat("transform.model", sc.baseTransforms[1])
	gl.UseProgram(0)

	m := getPentagon()
	sc.Meshes[0] = m
	sc.curMesh = m

	m, err = mesh.LoadMeshFromOBJ("assets/models/cube.obj")
	if err != nil {
		return nil, err
	}
	sc.Meshes[1] = m

	sc.Camera = camera.NewCamera(mgl32.Vec3{0, 0, 3},
		-90, 0, 45, float32(Width)/Height, 3, 0.1)

	return sc, nil
}

func (sc *Scene) DrawSceneOneShape() {
	sc.curShaderProg.Use()
	sc.curMesh.Draw()
}

func NewScenePedestal(window *glfw.Window) (*Scene, error) {
	sc := &Scene{Window: window, LastPosX: float64(Width) / 2, LastPosY: float64(Height) / 2, FirstMouse: true,
		mode: -1, ShaderProgs: make([]shader.ShaderProgram, 1), Meshes: make([]*mesh.Mesh, 1),
		baseTransforms: make([]mgl32.Mat4, 4), cubeAngles: make([]float32, 4)}

	shaderProg, err := shader.NewShaderProgram("assets/shaders/simple.vert", "assets/shaders/simple.frag")
	if err != nil {
		return nil, err
	}
	sc.ShaderProgs[0] = shaderProg
	sc.curShaderProg = &sc.ShaderProgs[0]

	m, err := mesh.LoadMeshFromOBJ("assets/models/cube.obj")
	if err != nil {
		return nil, err
	}
	sc.Meshes[0] = m
	sc.curMesh = m
	sc.getBaseTransformsForPedestal()

	sc.Camera = camera.NewCamera(mgl32.Vec3{0, 0, 3},
		-90, 0, 45, float32(Width)/Height, 3, 0.1)

	return sc, nil
}

func (sc *Scene) DrawScenePedestal() {
	sc.curShaderProg.Use()
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

func NewSceneSevenShapes(window *glfw.Window) (*Scene, error) {
	sc := &Scene{Window: window, LastPosX: float64(Width) / 2, LastPosY: float64(Height) / 2, FirstMouse: true,
		mode: -2, ShaderProgs: make([]shader.ShaderProgram, 6), Meshes: make([]*mesh.Mesh, 3),
		baseTransforms: make([]mgl32.Mat4, 7), dynTransforms: make([]mgl32.Mat4, 7)}

	paths := []string{"assets/shaders/simple_br.frag", "assets/shaders/stripes_br.frag", "assets/shaders/checker.frag",
		"assets/shaders/horiz_stripes.frag", "assets/shaders/diag_stripes.frag",
	}
	for i := range 5 {
		shaderProg, err := shader.NewShaderProgram("assets/shaders/simple.vert", paths[i])
		if err != nil {
			return nil, err
		}
		sc.ShaderProgs[i] = shaderProg
	}

	shaderProg, err := shader.NewShaderProgram("assets/shaders/simple_color.vert", "assets/shaders/simple_color.frag")
	if err != nil {
		return nil, err
	}
	sc.ShaderProgs[5] = shaderProg
	sc.curShaderProg = &sc.ShaderProgs[0]

	m := getPentagon()
	sc.Meshes[0] = m

	m, err = mesh.LoadMeshFromOBJ("assets/models/cube.obj")
	if err != nil {
		return nil, err
	}
	sc.Meshes[1] = m

	m = mesh.GetCubeWithColoredFaces()
	sc.Meshes[2] = m
	sc.getSevenShapesTransforms()

	sc.Camera = camera.NewCamera(mgl32.Vec3{0, 0, 3},
		-90, 0, 45, float32(Width)/Height, 3, 0.1)

	return sc, nil
}

func (sc *Scene) DrawSceneSevenShapes() {
	for i := range sc.dynTransforms {
		switch i {
		case 0, 1:
			sc.curShaderProg = &sc.ShaderProgs[0]
			sc.curShaderProg.SetUniformFloat("const_color", 1.0, 0.0, 0.0)
		default:
			sc.curShaderProg = &sc.ShaderProgs[i-1]
		}
		sc.curShaderProg.Use()

		if i == sc.activeMeshInd {
			sc.curShaderProg.SetUniformFloat("brightness", 1.2)
		} else {
			sc.curShaderProg.SetUniformFloat("brightness", 0.8)
		}

		sc.curShaderProg.SetUniformSqMatrFloat("transform.model", sc.dynTransforms[i])
		sc.UpdateViewProjPos()

		switch i {
		case 0:
			sc.curMesh = sc.Meshes[0]
		case 6:
			sc.curMesh = sc.Meshes[2]
		default:
			sc.curMesh = sc.Meshes[1]
		}
		sc.curMesh.Draw()
	}
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
	// --------------------------------- For lab 1 ---------------------------------
	if sc.mode > -1 {
		if sc.Window.GetKey(glfw.Key1) == glfw.Press {
			sc.mode = 0
			sc.curShaderProg = &sc.ShaderProgs[0]
			sc.curShaderProg.Use()
			sc.curShaderProg.SetUniformFloat("const_color", 0.75, 0.0, 0.0)
			sc.curShaderProg.SetUniformSqMatrFloat("transform.model", sc.baseTransforms[0])
			sc.curMesh = sc.Meshes[0]
		}
		if sc.Window.GetKey(glfw.Key2) == glfw.Press {
			sc.mode = 1
			sc.curShaderProg = &sc.ShaderProgs[0]
			sc.curShaderProg.Use()
			sc.curShaderProg.SetUniformFloat("const_color", 0.0, 0.75, 0.75)
			sc.curShaderProg.SetUniformSqMatrFloat("transform.model", sc.baseTransforms[1])
			sc.curMesh = sc.Meshes[1]
		}
		if sc.Window.GetKey(glfw.Key3) == glfw.Press {
			sc.mode = 2
			sc.curShaderProg = &sc.ShaderProgs[1]
			sc.curShaderProg.Use()
			sc.curShaderProg.SetUniformSqMatrFloat("transform.model", sc.baseTransforms[1])
			sc.curMesh = sc.Meshes[1]
		}
	} else if sc.mode == -1 {
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
	} else {
		// --------------------------------- For lab 2 ---------------------------------
		if sc.Window.GetKey(glfw.Key1) == glfw.Press {
			sc.activeMeshInd = 0
		}
		if sc.Window.GetKey(glfw.Key2) == glfw.Press {
			sc.activeMeshInd = 1
		}
		if sc.Window.GetKey(glfw.Key3) == glfw.Press {
			sc.activeMeshInd = 2
		}
		if sc.Window.GetKey(glfw.Key4) == glfw.Press {
			sc.activeMeshInd = 3
		}
		if sc.Window.GetKey(glfw.Key5) == glfw.Press {
			sc.activeMeshInd = 4
		}
		if sc.Window.GetKey(glfw.Key6) == glfw.Press {
			sc.activeMeshInd = 5
		}
		if sc.Window.GetKey(glfw.Key7) == glfw.Press {
			sc.activeMeshInd = 6
		}

		if sc.Window.GetKey(glfw.KeyUp) == glfw.Press {
			sc.processTranslation(0, 1, 0)
		}
		if sc.Window.GetKey(glfw.KeyDown) == glfw.Press {
			sc.processTranslation(0, -1, 0)
		}
		if sc.Window.GetKey(glfw.KeyLeft) == glfw.Press {
			sc.processTranslation(-1, 0, 0)
		}
		if sc.Window.GetKey(glfw.KeyRight) == glfw.Press {
			sc.processTranslation(1, 0, 0)
		}
		if sc.Window.GetKey(glfw.KeyPageUp) == glfw.Press {
			sc.processTranslation(0, 0, 1)
		}
		if sc.Window.GetKey(glfw.KeyPageDown) == glfw.Press {
			sc.processTranslation(0, 0, -1)
		}

		if sc.Window.GetKey(glfw.KeyMinus) == glfw.Press {
			sc.processScale(-1.1)
		}
		if sc.Window.GetKey(glfw.KeyEqual) == glfw.Press {
			sc.processScale(1.1)
		}

		if sc.Window.GetKey(glfw.KeyX) == glfw.Press {
			sc.processRotation(1, 0, 0)
		}
		if sc.Window.GetKey(glfw.KeyY) == glfw.Press {
			sc.processRotation(0, 1, 0)
		}
		if sc.Window.GetKey(glfw.KeyZ) == glfw.Press {
			sc.processRotation(0, 0, 1)
		}

		if sc.Window.GetKey(glfw.KeyR) == glfw.Press {
			copy(sc.dynTransforms, sc.baseTransforms)
		}
	}
}

func (sc *Scene) UpdateViewProjPos() {
	sc.curShaderProg.SetUniformSqMatrFloat("transform.view", sc.Camera.GetViewMatrix())
	sc.curShaderProg.SetUniformSqMatrFloat("transform.projection", sc.Camera.GetProjectionMatrix())
	sc.curShaderProg.SetUniformFloat("view_pos", sc.Camera.Position[0],
		sc.Camera.Position[1], sc.Camera.Position[2])
}

func (sc *Scene) UpdateDeltaTime(currentFrame float32) {
	sc.deltaTime = currentFrame - sc.lastFrame
	sc.lastFrame = currentFrame
}

func (sc *Scene) Release() {
	for _, m := range sc.Meshes {
		m.DeleteBuffers()
	}
	for _, sh := range sc.ShaderProgs {
		sh.Delete()
	}
}

// --------------------------------- For lab 1 ---------------------------------

func getPentagon() *mesh.Mesh {
	vertices := make([]mesh.Vertex, 5)
	indices := []uint32{
		0, 1, 2,
		0, 2, 3,
		0, 3, 4,
	}

	alpha := -3 * math.Pi / 10
	const delta = 2 * math.Pi / 5

	for i := range 5 {
		vertices[i].Position[0] = float32(math.Cos(alpha))
		vertices[i].Position[1] = float32(math.Sin(alpha))
		alpha += delta
	}

	m, _ := mesh.NewMesh(vertices, indices)
	return m
}

func (sc *Scene) getBaseTransformsForPedestal() {
	model := mgl32.Translate3D(2, 0, 0)
	sc.baseTransforms[0] = model
	sc.baseTransforms[1] = model.Mul4(mgl32.Translate3D(0, 0.5, 0))
	sc.baseTransforms[2] = model.Mul4(mgl32.Translate3D(0.5, 0, 0))
	sc.baseTransforms[3] = model.Mul4(mgl32.Translate3D(-0.5, 0, 0))
	for i := range sc.baseTransforms {
		sc.baseTransforms[i] = sc.baseTransforms[i].Mul4(mgl32.Scale3D(0.25, 0.25, 0.25))
	}
}

func (sc *Scene) drawCube(index int, pedestalTransform mgl32.Mat4, color mgl32.Vec3) {
	rotationMatr := mgl32.HomogRotate3DY(sc.cubeAngles[index])
	transform := pedestalTransform.Mul4(sc.baseTransforms[index].Mul4(rotationMatr))

	sc.curShaderProg.SetUniformFloat("const_color", color[0], color[1], color[2])
	sc.curShaderProg.SetUniformSqMatrFloat("transform.model", transform)

	sc.curMesh.Draw()
}

func (sc *Scene) calcPedestalCenter() mgl32.Vec3 {
	var center mgl32.Vec3
	for _, tr := range sc.baseTransforms {
		pos := tr.Col(3).Vec3()
		center = center.Add(pos)
	}
	return center.Mul(1.0 / 4.0)
}

// --------------------------------- For lab 2 ---------------------------------

func (sc *Scene) getSevenShapesTransforms() {
	model := mgl32.Translate3D(-1, 0, 0)
	sc.baseTransforms[0] = model
	sc.baseTransforms[1] = model.Mul4(mgl32.Translate3D(1, 0, 0))
	sc.baseTransforms[2] = model.Mul4(mgl32.Translate3D(2, 0, 0))
	sc.baseTransforms[3] = model.Mul4(mgl32.Translate3D(3, 0, 0))
	sc.baseTransforms[4] = model.Mul4(mgl32.Translate3D(0, -1, 0))
	sc.baseTransforms[5] = model.Mul4(mgl32.Translate3D(1, -1, 0))
	sc.baseTransforms[6] = model.Mul4(mgl32.Translate3D(2, -1, 0))
	for i := range sc.baseTransforms {
		sc.baseTransforms[i] = sc.baseTransforms[i].Mul4(mgl32.Scale3D(0.25, 0.25, 0.25))
		sc.dynTransforms[i] = sc.baseTransforms[i]
	}
}

func (sc *Scene) processTranslation(dx, dy, dz float32) {
	translation := mgl32.Translate3D(dx*sc.deltaTime, dy*sc.deltaTime, dz*sc.deltaTime)
	sc.dynTransforms[sc.activeMeshInd] = sc.dynTransforms[sc.activeMeshInd].Mul4(translation)
}

func (sc *Scene) processScale(factor float32) {
	scale := mgl32.Scale3D(1.0+factor*sc.deltaTime, 1.0+factor*sc.deltaTime, 1.0+factor*sc.deltaTime)
	sc.dynTransforms[sc.activeMeshInd] = sc.dynTransforms[sc.activeMeshInd].Mul4(scale)
}

func (sc *Scene) processRotation(dx, dy, dz float32) {
	angle := sc.deltaTime
	var rotation mgl32.Mat4
	if dx != 0 {
		rotation = mgl32.HomogRotate3DX(angle * dx)
	} else if dy != 0 {
		rotation = mgl32.HomogRotate3DY(angle * dy)
	} else if dz != 0 {
		rotation = mgl32.HomogRotate3DZ(angle * dz)
	}
	sc.dynTransforms[sc.activeMeshInd] = sc.dynTransforms[sc.activeMeshInd].Mul4(rotation)
}
