package shader

import (
	"fmt"
	"os"
	"strings"

	"github.com/go-gl/gl/all-core/gl"
	"github.com/go-gl/mathgl/mgl32"
)

type ShaderProgram struct {
	ID uint32
}

func NewShaderProgram(vertexShaderPath string, fragmentShaderPath string) (ShaderProgram, error) {
	vertexSource, err := os.ReadFile(vertexShaderPath)
	if err != nil {
		return ShaderProgram{0}, fmt.Errorf("failed to read vertex shader: %w", err)
	}

	fragmentSource, err := os.ReadFile(fragmentShaderPath)
	if err != nil {
		return ShaderProgram{0}, fmt.Errorf("failed to read fragment shader: %w", err)
	}

	vertexShader, err := compileShader(string(vertexSource), gl.VERTEX_SHADER, "VERTEX")
	if err != nil {
		return ShaderProgram{0}, err
	}
	defer gl.DeleteShader(vertexShader)

	fragmentShader, err := compileShader(string(fragmentSource), gl.FRAGMENT_SHADER, "FRAGMENT")
	if err != nil {
		return ShaderProgram{0}, err
	}
	defer gl.DeleteShader(fragmentShader)

	progID := gl.CreateProgram()
	gl.AttachShader(progID, vertexShader)
	gl.AttachShader(progID, fragmentShader)
	gl.LinkProgram(progID)
	if err := checkCompOrLinkErrors(progID, "PROGRAM"); err != nil {
		gl.DeleteProgram(progID)
		return ShaderProgram{0}, err
	}

	return ShaderProgram{progID}, nil
}

func (s ShaderProgram) Use() { gl.UseProgram(s.ID) }

func (s ShaderProgram) Delete() { gl.DeleteProgram(s.ID) }

func (s ShaderProgram) SetUniformFloat(name string, values ...float32) error {
	unifLoc := gl.GetUniformLocation(s.ID, gl.Str(name+"\x00"))
	if unifLoc < 0 {
		return fmt.Errorf("SetUniformFloat: uniform %q not found", name)
	}

	switch len(values) {
	case 1:
		gl.Uniform1f(unifLoc, values[0])
	case 2:
		gl.Uniform2f(unifLoc, values[0], values[1])
	case 3:
		gl.Uniform3f(unifLoc, values[0], values[1], values[2])
	case 4:
		gl.Uniform4f(unifLoc, values[0], values[1], values[2], values[3])
	default:
		return fmt.Errorf("SetUniformFloat: expected 1-4 values, got %d", len(values))
	}

	return nil
}

func (s ShaderProgram) SetUniformInt(name string, values ...int32) error {
	unifLoc := gl.GetUniformLocation(s.ID, gl.Str(name+"\x00"))
	if unifLoc < 0 {
		return fmt.Errorf("SetUniformInt: uniform %q not found", name)
	}

	switch len(values) {
	case 1:
		gl.Uniform1i(unifLoc, values[0])
	case 2:
		gl.Uniform2i(unifLoc, values[0], values[1])
	case 3:
		gl.Uniform3i(unifLoc, values[0], values[1], values[2])
	case 4:
		gl.Uniform4i(unifLoc, values[0], values[1], values[2], values[3])
	default:
		return fmt.Errorf("SetUniformInt: expected 1-4 values, got %d", len(values))
	}

	return nil
}

func (s ShaderProgram) SetUniformSqMatrFloat(name string, matrix any) error {
	unifLoc := gl.GetUniformLocation(s.ID, gl.Str(name+"\x00"))
	if unifLoc < 0 {
		return fmt.Errorf("SetUniformSqMatrFloat: uniform %q not found", name)
	}

	switch m := matrix.(type) {
	case mgl32.Mat2:
		gl.UniformMatrix2fv(unifLoc, 1, false, &m[0])
	case mgl32.Mat3:
		gl.UniformMatrix3fv(unifLoc, 1, false, &m[0])
	case mgl32.Mat4:
		gl.UniformMatrix4fv(unifLoc, 1, false, &m[0])
	default:
		return fmt.Errorf("SetUniformSqMatrFloat: unsupported type %T", m)
	}

	return nil
}

func compileShader(source string, shaderType uint32, typeName string) (uint32, error) {
	shader := gl.CreateShader(shaderType)

	csource, free := gl.Strs(source + "\x00")
	gl.ShaderSource(shader, 1, csource, nil)
	free()
	gl.CompileShader(shader)

	if err := checkCompOrLinkErrors(shader, typeName); err != nil {
		gl.DeleteShader(shader)
		return 0, err
	}

	return shader, nil
}

func checkCompOrLinkErrors(ID uint32, typeName string) error {
	var status int32

	if typeName == "PROGRAM" {
		gl.GetProgramiv(ID, gl.LINK_STATUS, &status)
		if status == gl.FALSE {
			var logLength int32
			gl.GetProgramiv(ID, gl.INFO_LOG_LENGTH, &logLength)

			log := strings.Repeat("\x00", int(logLength+1))
			gl.GetProgramInfoLog(ID, logLength, nil, gl.Str(log))

			return fmt.Errorf("linking error (%s):\n%s", typeName, log)
		}
	} else {
		gl.GetShaderiv(ID, gl.COMPILE_STATUS, &status)
		if status == gl.FALSE {
			var logLength int32
			gl.GetShaderiv(ID, gl.INFO_LOG_LENGTH, &logLength)

			log := strings.Repeat("\x00", int(logLength+1))
			gl.GetShaderInfoLog(ID, logLength, nil, gl.Str(log))

			return fmt.Errorf("shader compilation error (%s):\n%s", typeName, log)
		}
	}

	return nil
}
