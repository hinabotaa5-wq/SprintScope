# API Migration Inventory

This file maps existing frontend CRUD calls to Go API endpoints.

## Board

- `board_posts.select/order` -> `GET /api/board/posts?sort=newest|oldest`
- `board_posts.insert` -> `POST /api/board/posts`
- `board_posts.delete` -> `DELETE /api/board/posts/{postId}`
- `board_video_reports.insert` -> `POST /api/board/posts/{postId}/reports`
- `board_comments.select` -> `GET /api/board/posts/{postId}/comments`
- `board_comments.insert` -> `POST /api/board/posts/{postId}/comments`
- `board_comments.update` -> `PATCH /api/board/posts/{postId}/comments/{commentId}`
- `board_comments.delete` -> `DELETE /api/board/posts/{postId}/comments/{commentId}`
- `board_comment_reports.insert` -> `POST /api/board/posts/{postId}/comments/{commentId}/report`
- `board_inquiries.insert` -> `POST /api/board/inquiries`

## Question Box

- `questions.select` (coach dashboard) -> `GET /api/questions`
- `questions.select` (my replies) -> `GET /api/questions?questioner_uid={uid}&limit=50`
- `questions.insert` -> `POST /api/questions`
- `questions.update` -> `PATCH /api/questions/{id}`

## Checkout (KOMOJU)

- hosted checkout redirect -> `GET /api/checkout/komoju?ref={ref}&amount={yen}&tier=&format=&payment_method=card|paypay|applepay`
- return from KOMOJU -> `GET /api/checkout/return?ref={ref}&session_id={id}` (redirects to `FRONTEND_RETURN_URL`)
- payment webhook -> `POST /api/webhooks/komoju`

## Core

- `auth.getSession + debug /api/me` -> `GET /api/me`
- service health -> `GET /healthz`, `GET /readyz`
