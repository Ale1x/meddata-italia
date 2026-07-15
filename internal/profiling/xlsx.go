package profiling

import (
	"archive/zip"
	"bytes"
	"encoding/xml"
	"fmt"
	"io"
	"strconv"
	"strings"
)

func ReadXLSX(data []byte) ([][]string, error) {
	zr, err := zip.NewReader(bytes.NewReader(data), int64(len(data)))
	if err != nil {
		return nil, err
	}
	files := map[string]*zip.File{}
	for _, f := range zr.File {
		files[f.Name] = f
	}
	shared, err := readSharedStrings(files["xl/sharedStrings.xml"])
	if err != nil {
		return nil, err
	}
	sheet := files["xl/worksheets/sheet1.xml"]
	if sheet == nil {
		return nil, fmt.Errorf("sheet1.xml missing")
	}
	r, err := sheet.Open()
	if err != nil {
		return nil, err
	}
	defer r.Close()
	decoder := xml.NewDecoder(r)
	var rows [][]string
	var row []string
	var cellRef, cellType, value string
	inCell, inValue := false, false
	for {
		token, err := decoder.Token()
		if err == io.EOF {
			break
		}
		if err != nil {
			return nil, err
		}
		switch v := token.(type) {
		case xml.StartElement:
			switch v.Name.Local {
			case "row":
				row = nil
			case "c":
				inCell = true
				cellRef = ""
				cellType = ""
				value = ""
				for _, a := range v.Attr {
					if a.Name.Local == "r" {
						cellRef = a.Value
					}
					if a.Name.Local == "t" {
						cellType = a.Value
					}
				}
			case "v":
				if inCell {
					inValue = true
				}
			}
		case xml.CharData:
			if inValue {
				value += string(v)
			}
		case xml.EndElement:
			switch v.Name.Local {
			case "v":
				inValue = false
			case "c":
				col := columnIndex(cellRef)
				for len(row) <= col {
					row = append(row, "")
				}
				if cellType == "s" {
					idx, _ := strconv.Atoi(value)
					if idx >= 0 && idx < len(shared) {
						row[col] = shared[idx]
					}
				} else {
					row[col] = value
				}
				inCell = false
			case "row":
				rows = append(rows, row)
			}
		}
	}
	return rows, nil
}
func readSharedStrings(file *zip.File) ([]string, error) {
	if file == nil {
		return nil, nil
	}
	r, err := file.Open()
	if err != nil {
		return nil, err
	}
	defer r.Close()
	decoder := xml.NewDecoder(r)
	var out []string
	var current strings.Builder
	inSI, inText := false, false
	for {
		token, err := decoder.Token()
		if err == io.EOF {
			break
		}
		if err != nil {
			return nil, err
		}
		switch v := token.(type) {
		case xml.StartElement:
			if v.Name.Local == "si" {
				inSI = true
				current.Reset()
			}
			if v.Name.Local == "t" && inSI {
				inText = true
			}
		case xml.CharData:
			if inText {
				current.Write(v)
			}
		case xml.EndElement:
			if v.Name.Local == "t" {
				inText = false
			}
			if v.Name.Local == "si" {
				out = append(out, current.String())
				inSI = false
			}
		}
	}
	return out, nil
}
func columnIndex(ref string) int {
	n := 0
	for _, r := range ref {
		if r < 'A' || r > 'Z' {
			break
		}
		n = n*26 + int(r-'A'+1)
	}
	if n == 0 {
		return 0
	}
	return n - 1
}
