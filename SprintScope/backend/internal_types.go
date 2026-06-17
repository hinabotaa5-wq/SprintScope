package main

import "encoding/json"

type appError struct {
	Status  int    `json:"-"`
	Code    string `json:"code"`
	Message string `json:"message"`
}

func (e *appError) Error() string {
	if e == nil {
		return ""
	}
	return e.Message
}

type authedUser struct {
	ID    string `json:"id"`
	Email string `json:"email,omitempty"`
	Role  string `json:"role,omitempty"`
}

type boardPost struct {
	ID           string `json:"id,omitempty"`
	URL          string `json:"url"`
	Title        string `json:"title,omitempty"`
	PersonalBest string `json:"personal_best,omitempty"`
	Question     string `json:"question,omitempty"`
	UserID       string `json:"user_id,omitempty"`
	UserName     string `json:"user_name,omitempty"`
	CreatedAt    string `json:"created_at,omitempty"`
	ThumbnailURL string `json:"thumbnail_url,omitempty"`
}

type boardComment struct {
	ID        string          `json:"id,omitempty"`
	PostID    string          `json:"post_id,omitempty"`
	Text      string          `json:"text"`
	UserID    string          `json:"user_id,omitempty"`
	UserName  string          `json:"user_name,omitempty"`
	CreatedAt string          `json:"created_at,omitempty"`
	UpdatedAt string          `json:"updated_at,omitempty"`
	ReplyTo   json.RawMessage `json:"reply_to,omitempty"`
}

type questionRow struct {
	ID                  string `json:"id,omitempty"`
	CreatedAt           string `json:"created_at,omitempty"`
	Tier                string `json:"tier"`
	Format              string `json:"format"`
	QuestionText        string `json:"question_text"`
	CoachID             string `json:"coach_id,omitempty"`
	AmountYen           int    `json:"amount_yen"`
	PaymentRef          string `json:"payment_ref"`
	VideoFilename       string `json:"video_filename,omitempty"`
	VideoStoragePath    string `json:"video_storage_path,omitempty"`
	QuestionerUID       string `json:"questioner_uid,omitempty"`
	CoachAdviceText     string `json:"coach_advice_text,omitempty"`
	CoachAdviceVideoURL string `json:"coach_advice_video_url,omitempty"`
	PaymentStatus       string `json:"payment_status,omitempty"`
	KomojuSessionID     string `json:"komoju_session_id,omitempty"`
}
