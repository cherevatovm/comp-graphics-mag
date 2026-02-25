package mesh

import (
	"bufio"
	"fmt"
	"os"
	"strconv"
	"strings"
	"unsafe"

	"github.com/cherevatovm/comp-graphics-mag/internal/texture"
	"github.com/go-gl/gl/all-core/gl"
	"github.com/go-gl/mathgl/mgl32"
)

type Vertex struct {
	Position  mgl32.Vec3
	Normal    mgl32.Vec3
	Color     mgl32.Vec3
	TexCoords mgl32.Vec2
}

type Mesh struct {
	vertices      []Vertex
	indices       []uint32
	Tex           *texture.Texture
	VAO, VBO, EBO uint32
}

func NewMesh(vertices []Vertex, indices []uint32) (*Mesh, error) {
	if len(vertices) == 0 {
		return nil, fmt.Errorf("vertices slice is empty")
	}
	if len(indices) == 0 {
		return nil, fmt.Errorf("indices slice is empty")
	}

	m := &Mesh{vertices: vertices, indices: indices}

	gl.GenVertexArrays(1, &m.VAO)
	gl.GenBuffers(1, &m.VBO)
	gl.GenBuffers(1, &m.EBO)

	gl.BindVertexArray(m.VAO)
	gl.BindBuffer(gl.ARRAY_BUFFER, m.VBO)
	gl.BufferData(gl.ARRAY_BUFFER, len(m.vertices)*int(unsafe.Sizeof(Vertex{})), gl.Ptr(m.vertices), gl.STATIC_DRAW)

	gl.BindBuffer(gl.ELEMENT_ARRAY_BUFFER, m.EBO)
	gl.BufferData(gl.ELEMENT_ARRAY_BUFFER, len(m.indices)*4, gl.Ptr(m.indices), gl.STATIC_DRAW)

	gl.EnableVertexAttribArray(0)
	gl.VertexAttribPointer(0, 3, gl.FLOAT, false, int32(unsafe.Sizeof(Vertex{})), nil)
	gl.EnableVertexAttribArray(1)
	gl.VertexAttribPointer(1, 3, gl.FLOAT, false, int32(unsafe.Sizeof(Vertex{})), unsafe.Pointer(unsafe.Offsetof(Vertex{}.Normal)))
	gl.EnableVertexAttribArray(2)
	gl.VertexAttribPointer(2, 3, gl.FLOAT, false, int32(unsafe.Sizeof(Vertex{})), unsafe.Pointer(unsafe.Offsetof(Vertex{}.Color)))
	gl.EnableVertexAttribArray(3)
	gl.VertexAttribPointer(3, 2, gl.FLOAT, false, int32(unsafe.Sizeof(Vertex{})), unsafe.Pointer(unsafe.Offsetof(Vertex{}.TexCoords)))
	gl.BindVertexArray(0)

	return m, nil
}

func LoadMeshFromOBJ(path string) (*Mesh, error) {
	file, err := os.Open(path)
	if err != nil {
		return nil, err
	}
	defer file.Close()

	var positions []mgl32.Vec3
	var normals []mgl32.Vec3
	var uvs []mgl32.Vec2

	var vertices []Vertex
	var indices []uint32

	vertMap := make(map[[3]int]uint32)

	scanner := bufio.NewScanner(file)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}

		fields := strings.Fields(line)
		switch fields[0] {
		case "v":
			x, _ := strconv.ParseFloat(fields[1], 32)
			y, _ := strconv.ParseFloat(fields[2], 32)
			z, _ := strconv.ParseFloat(fields[3], 32)
			positions = append(positions, mgl32.Vec3{
				float32(x), float32(y), float32(z),
			})

		case "vn":
			x, _ := strconv.ParseFloat(fields[1], 32)
			y, _ := strconv.ParseFloat(fields[2], 32)
			z, _ := strconv.ParseFloat(fields[3], 32)
			normals = append(normals, mgl32.Vec3{
				float32(x), float32(y), float32(z),
			})

		case "vt":
			u, _ := strconv.ParseFloat(fields[1], 32)
			v, _ := strconv.ParseFloat(fields[2], 32)
			uvs = append(uvs, mgl32.Vec2{
				float32(u), float32(v),
			})

		case "f":
			for i := 3; i < len(fields); i++ {
				triangle := [3]string{
					fields[1], fields[i-1], fields[i],
				}

				for _, val := range triangle {
					vInd, vtInd, vnInd := processFaceOBJ(val)
					key := [3]int{vInd, vtInd, vnInd}

					index, ok := vertMap[key]
					if !ok {
						if vInd >= len(positions) {
							return nil, fmt.Errorf("vertex index %d out of range", vInd)
						}
						vertex := Vertex{Position: positions[vInd]}

						if vtInd >= 0 && vtInd < len(uvs) {
							vertex.TexCoords = uvs[vtInd]
						}

						if vnInd >= 0 && vnInd < len(normals) {
							vertex.Normal = normals[vnInd]
						}

						vertices = append(vertices, vertex)
						index = uint32(len(vertices) - 1)
						vertMap[key] = index
					}

					indices = append(indices, index)
				}
			}
		}

	}

	if err := scanner.Err(); err != nil {
		return nil, err
	}

	m, err := NewMesh(vertices, indices)
	if err != nil {
		return nil, err
	}

	return m, nil
}

// --------------------------------- For lab 2 ---------------------------------

func GetCubeWithColoredFaces() *Mesh {
	vertices := []Vertex{
		{Position: mgl32.Vec3{-1.0, -1.0, 1.0}}, {Position: mgl32.Vec3{1.0, -1.0, 1.0}},
		{Position: mgl32.Vec3{1.0, 1.0, 1.0}}, {Position: mgl32.Vec3{-1.0, 1.0, 1.0}},

		{Position: mgl32.Vec3{-1.0, -1.0, -1.0}}, {Position: mgl32.Vec3{1.0, -1.0, -1.0}},
		{Position: mgl32.Vec3{1.0, 1.0, -1.0}}, {Position: mgl32.Vec3{-1.0, 1.0, -1.0}},

		{Position: mgl32.Vec3{-1.0, -1.0, -1.0}}, {Position: mgl32.Vec3{-1.0, -1.0, 1.0}},
		{Position: mgl32.Vec3{-1.0, 1.0, 1.0}}, {Position: mgl32.Vec3{-1.0, 1.0, -1.0}},

		{Position: mgl32.Vec3{1.0, -1.0, -1.0}}, {Position: mgl32.Vec3{1.0, -1.0, 1.0}},
		{Position: mgl32.Vec3{1.0, 1.0, 1.0}}, {Position: mgl32.Vec3{1.0, 1.0, -1.0}},

		{Position: mgl32.Vec3{-1.0, 1.0, 1.0}}, {Position: mgl32.Vec3{1.0, 1.0, 1.0}},
		{Position: mgl32.Vec3{1.0, 1.0, -1.0}}, {Position: mgl32.Vec3{-1.0, 1.0, -1.0}},

		{Position: mgl32.Vec3{-1.0, -1.0, 1.0}}, {Position: mgl32.Vec3{1.0, -1.0, 1.0}},
		{Position: mgl32.Vec3{1.0, -1.0, -1.0}}, {Position: mgl32.Vec3{-1.0, -1.0, -1.0}},
	}

	indices := []uint32{
		0, 1, 2, 0, 2, 3,
		4, 5, 6, 4, 6, 7,
		8, 9, 10, 8, 10, 11,
		12, 13, 14, 12, 14, 15,
		16, 17, 18, 16, 18, 19,
		20, 21, 22, 20, 22, 23,
	}

	colors := [6]mgl32.Vec3{
		{1.0, 0.0, 0.0}, {0.0, 1.0, 0.0},
		{0.0, 0.0, 1.0}, {1.0, 1.0, 0.0},
		{1.0, 0.0, 1.0}, {0.0, 1.0, 1.0},
	}

	for i := 0; i < len(vertices); i += 4 {
		for j := range 4 {
			vertices[i+j].Color = colors[i/4]
		}
	}

	m, _ := NewMesh(vertices, indices)
	return m
}

// -----------------------------------------------------------------------------

func (m *Mesh) Draw() {
	gl.BindVertexArray(m.VAO)
	gl.DrawElements(gl.TRIANGLES, int32(len(m.indices)), gl.UNSIGNED_INT, nil)
	gl.BindVertexArray(0)
}

func (m *Mesh) DeleteBuffers() {
	gl.DeleteVertexArrays(1, &m.VAO)
	gl.DeleteBuffers(1, &m.VBO)
	gl.DeleteBuffers(1, &m.EBO)
}

func (m *Mesh) SetTexture(tex *texture.Texture) { m.Tex = tex }

func processFaceOBJ(vertToken string) (v, vt, vn int) {
	vt, vn = -1, -1
	tokens := strings.Split(vertToken, "/")

	v, _ = strconv.Atoi(tokens[0])
	v--

	if len(tokens) > 1 && tokens[1] != "" {
		vt, _ = strconv.Atoi(tokens[1])
		vt--
	}

	if len(tokens) > 2 && tokens[2] != "" {
		vn, _ = strconv.Atoi(tokens[2])
		vn--
	}

	return
}
