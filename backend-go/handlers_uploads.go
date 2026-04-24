package main

import (
	"bytes"
	"encoding/json"
	"io"
	"mime/multipart"
	"net/http"
	"strings"
	"time"
)

func (s *server) handleVideoUpload(w http.ResponseWriter, r *http.Request) {
	if _, err := s.mustUser(r); err != nil {
		writeErrorWithOp(w, "uploads.video.mustUser", err)
		return
	}
	if err := r.ParseMultipartForm(100 << 20); err != nil {
		writeErrorWithOp(w, "uploads.video.parseMultipart", &appError{
			Status:  http.StatusBadRequest,
			Code:    "invalid_multipart",
			Message: "invalid multipart form",
		})
		return
	}

	file, fh, err := r.FormFile("file")
	if err != nil {
		writeErrorWithOp(w, "uploads.video.missingFile", &appError{
			Status:  http.StatusBadRequest,
			Code:    "missing_file",
			Message: "file is required",
		})
		return
	}
	defer file.Close()

	var body bytes.Buffer
	writer := multipart.NewWriter(&body)
	part, err := writer.CreateFormFile("file", fh.Filename)
	if err != nil {
		writeErrorWithOp(w, "uploads.video.createFormFile", err)
		return
	}
	if _, err := io.Copy(part, file); err != nil {
		writeErrorWithOp(w, "uploads.video.copyFile", err)
		return
	}
	_ = writer.WriteField("upload_preset", s.cfg.CloudPreset)
	tags := strings.TrimSpace(r.FormValue("tags"))
	if tags == "" {
		tags = "auto_delete_90d"
	}
	_ = writer.WriteField("tags", tags)
	if err := writer.Close(); err != nil {
		writeErrorWithOp(w, "uploads.video.closeWriter", err)
		return
	}

	cloudURL := "https://api.cloudinary.com/v1_1/" + s.cfg.CloudName + "/video/upload"
	req, err := http.NewRequest(http.MethodPost, cloudURL, &body)
	if err != nil {
		writeErrorWithOp(w, "uploads.video.newRequest", err)
		return
	}
	req.Header.Set("Content-Type", writer.FormDataContentType())

	client := &http.Client{Timeout: 60 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		writeErrorWithOp(w, "uploads.video.cloudinaryRequest", err)
		return
	}
	defer resp.Body.Close()
	raw, _ := io.ReadAll(resp.Body)
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		writeErrorWithOp(w, "uploads.video.cloudinaryStatus", &appError{
			Status:  http.StatusBadGateway,
			Code:    "cloudinary_upload_failed",
			Message: string(raw),
		})
		return
	}

	var out map[string]any
	if err := json.Unmarshal(raw, &out); err != nil {
		writeErrorWithOp(w, "uploads.video.parseResponse", err)
		return
	}
	writeJSON(w, http.StatusOK, out)
}
