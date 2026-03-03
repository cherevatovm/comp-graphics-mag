package scene

import (
	"github.com/cherevatovm/comp-graphics-mag/internal/camera"
	"github.com/cherevatovm/comp-graphics-mag/internal/mesh"
	"github.com/cherevatovm/comp-graphics-mag/internal/shader"
	"github.com/cherevatovm/comp-graphics-mag/internal/texture"
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

	Textures []*texture.Texture

	Window *glfw.Window
	Camera *camera.Camera

	LastPosX, LastPosY float64
	FirstMouse         bool

	mode, activeMeshInd, activeShInd int
	baseTransforms                   []mgl32.Mat4
	dynTransforms                    []mgl32.Mat4
	normalTransforms                 []mgl32.Mat3

	coefVals      [3]float32
	cubeAngles    []float32
	pedestalAngle float32
	globalAngle   float32

	deltaTime, lastFrame float32
}

// --------------------------------- For lab 1 ---------------------------------

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

	m := mesh.GetPentagon()
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

// --------------------------------- For lab 2 ---------------------------------

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

	m := mesh.GetPentagon()
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

// --------------------------------- For lab 3 ---------------------------------

func NewSceneWithLighting(window *glfw.Window) (*Scene, error) {
	sc := &Scene{Window: window, LastPosX: float64(Width) / 2, LastPosY: float64(Height) / 2, FirstMouse: true,
		mode: -3, ShaderProgs: make([]shader.ShaderProgram, 10), Meshes: make([]*mesh.Mesh, 3),
		Textures: make([]*texture.Texture, 1), baseTransforms: make([]mgl32.Mat4, 3), normalTransforms: make([]mgl32.Mat3, 3)}

	pathsVert := []string{"assets/shaders/lighting/basic_phong.vert", "assets/shaders/lighting/lambert_gouraud.vert",
		"assets/shaders/lighting/phong_phong.vert", "assets/shaders/lighting/phong_gouraud.vert",
		"assets/shaders/lighting/phong_phong.vert", "assets/shaders/lighting/blinn_phong_gouraud.vert",
		"assets/shaders/lighting/basic_phong.vert", "assets/shaders/lighting/toon_gouraud.vert",
		"assets/shaders/lighting/basic_phong.vert", "assets/shaders/lighting/oren_nayar_gouraud.vert",
	}
	pathsFrag := []string{"assets/shaders/lighting/lambert_phong.frag", "assets/shaders/lighting/basic_gouraud.frag",
		"assets/shaders/lighting/phong_phong.frag", "assets/shaders/lighting/basic_gouraud.frag",
		"assets/shaders/lighting/blinn_phong_phong.frag", "assets/shaders/lighting/basic_gouraud.frag",
		"assets/shaders/lighting/toon_phong.frag", "assets/shaders/lighting/basic_gouraud.frag",
		"assets/shaders/lighting/oren_nayar_phong.frag", "assets/shaders/lighting/basic_gouraud.frag",
	}
	sc.coefVals[0], sc.coefVals[1], sc.coefVals[2] = 0.2, 1, 1

	for i := range sc.ShaderProgs {
		shaderProg, err := shader.NewShaderProgram(pathsVert[i], pathsFrag[i])
		if err != nil {
			return nil, err
		}
		sc.ShaderProgs[i] = shaderProg
		sc.curShaderProg = &shaderProg
		sc.curShaderProg.Use()

		sc.curShaderProg.SetUniformFloat("light.position", -2.0, 0.8, 3.0)
		sc.curShaderProg.SetUniformFloat("light.ambient", 0.5, 0.5, 0.5)
		sc.curShaderProg.SetUniformFloat("light.diffuse", 1.0, 1.0, 1.0)
		sc.curShaderProg.SetUniformFloat("light.constant", 1.0)
		sc.curShaderProg.SetUniformFloat("light.linear", 0.045)
		sc.curShaderProg.SetUniformFloat("light.quadratic", 0.0075)
		sc.curShaderProg.SetUniformFloat("light.ambient_strength", sc.coefVals[0])
		sc.curShaderProg.SetUniformFloat("linear_coef", sc.coefVals[1])
		sc.curShaderProg.SetUniformFloat("quadratic_coef", sc.coefVals[2])

		switch i {
		case 2, 3, 4, 5:
			shaderProg.SetUniformFloat("light.specular", 1.0, 1.0, 1.0)
			shaderProg.SetUniformFloat("material.ambient", 0.75, 0.75, 0.75)
			shaderProg.SetUniformFloat("material.diffuse", 1.0, 1.0, 1.0)
			shaderProg.SetUniformFloat("material.specular", 0.5, 0.5, 0.5)
			shaderProg.SetUniformFloat("material.sheen_coef", 32.0)
		case 8, 9:
			sc.curShaderProg.SetUniformFloat("roughness", 0.5)
		}
		gl.UseProgram(0)
	}
	sc.curShaderProg = &sc.ShaderProgs[0]

	sc.Textures[0] = texture.NewWhiteTexture()
	pathsMesh := []string{"assets/models/snowman.obj", "assets/models/pinetree.obj", "assets/models/heart.obj"}
	for i := range sc.Meshes {
		m, err := mesh.LoadMeshFromOBJ(pathsMesh[i])
		if err != nil {
			return nil, err
		}
		sc.Meshes[i] = m
		sc.Meshes[i].SetTexture(sc.Textures[0])
	}

	sc.getLitShapesTransforms()
	sc.Camera = camera.NewCamera(mgl32.Vec3{0, 0, 3},
		-90, 0, 45, float32(Width)/Height, 3, 0.1)

	return sc, nil
}

func (sc *Scene) DrawSceneWithLighting() {
	sc.UpdateViewProjPos()
	for i := range sc.Meshes {
		sc.curShaderProg.SetUniformSqMatrFloat("transform.model", sc.baseTransforms[i])
		sc.curShaderProg.SetUniformSqMatrFloat("transform.normal_mat", sc.normalTransforms[i])
		sc.Meshes[i].DrawWithTex(*sc.curShaderProg)
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
	} else if sc.mode == -2 {
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
	} else {
		// --------------------------------- For lab 3 ---------------------------------
		if sc.Window.GetKey(glfw.Key1) == glfw.Press {
			sc.activeShInd = 0
			sc.curShaderProg = &sc.ShaderProgs[0]
			sc.resetCoefVals()
		}
		if sc.Window.GetKey(glfw.Key2) == glfw.Press {
			sc.activeShInd = 2
			sc.curShaderProg = &sc.ShaderProgs[2]
			sc.resetCoefVals()
		}
		if sc.Window.GetKey(glfw.Key3) == glfw.Press {
			sc.activeShInd = 4
			sc.curShaderProg = &sc.ShaderProgs[4]
			sc.resetCoefVals()
		}
		if sc.Window.GetKey(glfw.Key4) == glfw.Press {
			sc.activeShInd = 6
			sc.curShaderProg = &sc.ShaderProgs[6]
			sc.resetCoefVals()
		}
		if sc.Window.GetKey(glfw.Key5) == glfw.Press {
			sc.activeShInd = 8
			sc.curShaderProg = &sc.ShaderProgs[8]
			sc.resetCoefVals()
		}

		if sc.Window.GetKey(glfw.KeyP) == glfw.Press && sc.activeShInd%2 != 0 {
			sc.activeShInd--
			sc.curShaderProg = &sc.ShaderProgs[sc.activeShInd]
			sc.resetCoefVals()
		}
		if sc.Window.GetKey(glfw.KeyG) == glfw.Press && sc.activeShInd%2 == 0 {
			sc.activeShInd++
			sc.curShaderProg = &sc.ShaderProgs[sc.activeShInd]
			sc.resetCoefVals()
		}

		if sc.Window.GetKey(glfw.KeyMinus) == glfw.Press && sc.coefVals[0] > 0 {
			sc.coefVals[0] -= 0.1
			sc.curShaderProg.SetUniformFloat("light.ambient_strength", sc.coefVals[0])
		}
		if sc.Window.GetKey(glfw.KeyEqual) == glfw.Press && sc.coefVals[0] < 1 {
			sc.coefVals[0] += 0.1
			sc.curShaderProg.SetUniformFloat("light.ambient_strength", sc.coefVals[0])
		}

		if sc.Window.GetKey(glfw.KeyK) == glfw.Press && sc.coefVals[1] > 0 {
			sc.coefVals[1] -= 0.1
			sc.curShaderProg.SetUniformFloat("linear_coef", sc.coefVals[1])
		}
		if sc.Window.GetKey(glfw.KeyL) == glfw.Press && sc.coefVals[1] < 2 {
			sc.coefVals[1] += 0.1
			sc.curShaderProg.SetUniformFloat("linear_coef", sc.coefVals[1])
		}

		if sc.Window.GetKey(glfw.KeyN) == glfw.Press && sc.coefVals[2] > 0 {
			sc.coefVals[2] -= 0.1
			sc.curShaderProg.SetUniformFloat("quadratic_coef", sc.coefVals[2])
		}
		if sc.Window.GetKey(glfw.KeyM) == glfw.Press && sc.coefVals[2] < 2 {
			sc.coefVals[2] += 0.1
			sc.curShaderProg.SetUniformFloat("quadratic_coef", sc.coefVals[2])
		}
	}
}

func (sc *Scene) UpdateViewProjPos() {
	sc.curShaderProg.SetUniformSqMatrFloat("transform.view", sc.Camera.GetViewMatrix())
	sc.curShaderProg.SetUniformSqMatrFloat("transform.projection", sc.Camera.GetProjectionMatrix())
	sc.curShaderProg.SetUniformFloat("transform.view_pos", sc.Camera.Position[0],
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

// --------------------------------- For lab 3 ---------------------------------

func (sc *Scene) getLitShapesTransforms() {
	model := mgl32.Translate3D(-1, -1, 0)
	model = model.Mul4(mgl32.HomogRotate3DY(mgl32.DegToRad(-90)))
	model = model.Mul4(mgl32.Scale3D(0.5, 0.5, 0.5))
	sc.baseTransforms[0] = model
	sc.normalTransforms[0] = model.Inv().Transpose().Mat3()

	model = mgl32.Translate3D(1, 0, 0)
	sc.baseTransforms[1] = model
	sc.normalTransforms[1] = model.Inv().Transpose().Mat3()

	model = mgl32.Translate3D(-3, 0, 0)
	model = model.Mul4(mgl32.HomogRotate3DY(mgl32.DegToRad(30)))
	sc.baseTransforms[2] = model
	sc.normalTransforms[2] = model.Inv().Transpose().Mat3()
}

func (sc *Scene) resetCoefVals() {
	sc.coefVals[0], sc.coefVals[1], sc.coefVals[2] = 0.2, 1, 1
	sc.curShaderProg.Use()
	sc.curShaderProg.SetUniformFloat("light.ambient_strength", sc.coefVals[0])
	sc.curShaderProg.SetUniformFloat("linear_coef", sc.coefVals[1])
	sc.curShaderProg.SetUniformFloat("quadratic_coef", sc.coefVals[2])
}
