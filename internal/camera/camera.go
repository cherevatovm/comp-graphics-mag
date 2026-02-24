package camera

import (
	"math"

	"github.com/go-gl/mathgl/mgl32"
)

type Camera struct {
	Position mgl32.Vec3
	Front    mgl32.Vec3
	Up       mgl32.Vec3
	Right    mgl32.Vec3
	WorldUp  mgl32.Vec3

	Yaw, Pitch float32

	FOV, Aspect float32
	Near, Far   float32

	MovementSpeed    float32
	MouseSensitivity float32
}

func NewCamera(position mgl32.Vec3, yaw, pitch float32,
	fov, aspect, movSpeed, mouseSens float32) *Camera {
	c := &Camera{
		Position:         position,
		Front:            mgl32.Vec3{0, 0, -1},
		WorldUp:          mgl32.Vec3{0, 1, 0},
		Yaw:              yaw,
		Pitch:            pitch,
		FOV:              fov,
		Aspect:           aspect,
		Near:             0.1,
		Far:              100,
		MovementSpeed:    movSpeed,
		MouseSensitivity: mouseSens,
	}
	c.updateVectors()
	return c
}

const (
	Forward = iota
	Backward
	Left
	Right
)

func (c *Camera) ProcessKeyboard(direction int, deltaTime float32) {
	velocity := c.MovementSpeed * deltaTime
	switch direction {
	case Forward:
		c.Position = c.Position.Add(c.Front.Mul(velocity))
	case Backward:
		c.Position = c.Position.Sub(c.Front.Mul(velocity))
	case Left:
		c.Position = c.Position.Sub(c.Right.Mul(velocity))
	case Right:
		c.Position = c.Position.Add(c.Right.Mul(velocity))
	}
}

func (c *Camera) ProcessMouseMove(offX, offY float32) {
	c.Yaw += offX * c.MouseSensitivity
	c.Pitch += offY * c.MouseSensitivity

	if c.Pitch > 89 {
		c.Pitch = 89
	}
	if c.Pitch < -89 {
		c.Pitch = -89
	}

	c.updateVectors()
}

func (c *Camera) ProcessMouseScroll(offY float32) {
	c.FOV -= offY

	if c.FOV < 1 {
		c.FOV = 1
	}
	if c.FOV > 90 {
		c.FOV = 90
	}
}

func (c *Camera) GetViewMatrix() mgl32.Mat4 {
	return mgl32.LookAtV(c.Position, c.Position.Add(c.Front), c.Up)
}

func (c *Camera) GetProjectionMatrix() mgl32.Mat4 {
	return mgl32.Perspective(mgl32.DegToRad(c.FOV), c.Aspect, c.Near, c.Far)
}

func (c *Camera) SetAspectRatio(aspect float32) { c.Aspect = aspect }

func (c *Camera) updateVectors() {
	yawRad := mgl32.DegToRad(c.Yaw)
	pitchRad := mgl32.DegToRad(c.Pitch)

	front := mgl32.Vec3{
		float32(math.Cos(float64(yawRad)) * math.Cos(float64(pitchRad))),
		float32(math.Sin(float64(pitchRad))),
		float32(math.Sin(float64(yawRad)) * math.Cos(float64(pitchRad))),
	}

	c.Front = front.Normalize()
	c.Right = c.Front.Cross(c.WorldUp).Normalize()
	c.Up = c.Right.Cross(c.Front).Normalize()
}
