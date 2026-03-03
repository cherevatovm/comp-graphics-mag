package texture

import (
	"fmt"
	"image"
	"image/draw"
	_ "image/jpeg"
	_ "image/png"
	"os"

	"github.com/go-gl/gl/all-core/gl"
)

type Texture struct {
	Width  int
	Height int

	ID     uint32
	Format uint32
	Target uint32
}

func NewTexture(path string) (*Texture, error) {
	imgFile, err := os.Open(path)
	if err != nil {
		return nil, fmt.Errorf("id %q not found on disk: %w", path, err)
	}
	defer imgFile.Close()

	img, _, err := image.Decode(imgFile)
	if err != nil {
		return nil, fmt.Errorf("failed to decode %q: %w", path, err)
	}

	rgba := image.NewRGBA(img.Bounds())
	if rgba.Stride != rgba.Rect.Size().X*4 {
		return nil, fmt.Errorf("unsupported stride")
	}
	draw.Draw(rgba, rgba.Bounds(), img, image.Point{}, draw.Src)

	width := rgba.Rect.Size().X
	height := rgba.Rect.Size().Y

	var id uint32
	gl.GenTextures(1, &id)

	format := uint32(gl.RGBA)
	target := uint32(gl.TEXTURE_2D)

	gl.BindTexture(target, id)
	gl.TexParameteri(target, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR)
	gl.TexParameteri(target, gl.TEXTURE_MAG_FILTER, gl.LINEAR)

	gl.TexParameteri(target, gl.TEXTURE_WRAP_S, gl.REPEAT)
	gl.TexParameteri(target, gl.TEXTURE_WRAP_T, gl.REPEAT)

	gl.TexImage2D(
		target,
		0,
		int32(format),
		int32(width),
		int32(height),
		0,
		format,
		gl.UNSIGNED_BYTE,
		gl.Ptr(rgba.Pix),
	)

	gl.GenerateMipmap(target)
	gl.BindTexture(target, 0)

	return &Texture{width, height, id, format, target}, nil
}

func NewWhiteTexture() *Texture {
	data := []uint8{
		255, 255, 255, 255,
	}
	var id uint32
	gl.GenTextures(1, &id)

	format := uint32(gl.RGBA)
	target := uint32(gl.TEXTURE_2D)

	gl.BindTexture(target, id)
	gl.TexParameteri(target, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
	gl.TexParameteri(target, gl.TEXTURE_MAG_FILTER, gl.LINEAR)

	gl.TexImage2D(
		target,
		0,
		int32(format),
		1,
		1,
		0,
		format,
		gl.UNSIGNED_BYTE,
		gl.Ptr(data),
	)

	gl.BindTexture(target, 0)
	return &Texture{1, 1, id, format, target}
}

func (t *Texture) Bind(texUnit uint32) {
	gl.ActiveTexture(gl.TEXTURE0 + texUnit)
	gl.BindTexture(t.Target, t.ID)
}

func (t *Texture) Unbind() {
	gl.BindTexture(t.Target, 0)
}

func (t *Texture) Delete() {
	gl.DeleteTextures(1, &t.ID)
}

func (t *Texture) SetFiltering(min, mag int32) {
	gl.BindTexture(t.Target, t.ID)
	gl.TexParameteri(t.Target, gl.TEXTURE_MIN_FILTER, min)
	gl.TexParameteri(t.Target, gl.TEXTURE_MAG_FILTER, mag)
}

func (t *Texture) SetWrap(sparam, tparam int32) {
	gl.BindTexture(t.Target, t.ID)
	gl.TexParameteri(t.Target, gl.TEXTURE_WRAP_S, sparam)
	gl.TexParameteri(t.Target, gl.TEXTURE_WRAP_T, tparam)
}

func (t *Texture) GenerateMipmaps() {
	gl.BindTexture(t.Target, t.ID)
	gl.GenerateMipmap(t.Target)
}
