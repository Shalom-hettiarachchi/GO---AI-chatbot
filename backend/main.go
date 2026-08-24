package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"

	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool { return true },
}

type GeminiPart struct {
	Text string `json:"text"`
}

type GeminiContent struct {
	Parts []GeminiPart `json:"parts"`
}

type GeminiRequest struct {
	Contents []GeminiContent `json:"contents"`
}

type GeminiResponse struct {
	Candidates []struct {
		Content GeminiContent `json:"content"`
	} `json:"candidates"`
}

func callGemini(userPrompt string) (string, error) {
	apiKey := os.Getenv("GEMINI_API_KEY")
	if apiKey == "" {
		return "Error: GEMINI_API_KEY environment variable is missing on server.", nil
	}

	// Models to try in order if Google experiences a 503 traffic spike
	models := []string{"gemini-2.5-flash", "gemini-2.0-flash"}

	reqBody := GeminiRequest{
		Contents: []GeminiContent{
			{
				Parts: []GeminiPart{
					{Text: userPrompt},
				},
			},
		},
	}

	jsonData, err := json.Marshal(reqBody)
	if err != nil {
		return "", err
	}

	for _, model := range models {
		url := fmt.Sprintf("https://generativelanguage.googleapis.com/v1beta/models/%s:generateContent?key=%s", model, apiKey)

		resp, err := http.Post(url, "application/json", bytes.NewBuffer(jsonData))
		if err != nil {
			continue
		}

		body, err := io.ReadAll(resp.Body)
		resp.Body.Close()
		if err != nil {
			continue
		}

		// If Google returns 503 or 429, try the next model in the slice
		if resp.StatusCode == http.StatusServiceUnavailable || resp.StatusCode == http.StatusTooManyRequests {
			log.Printf("Model %s busy (%d). Trying fallback...\n", model, resp.StatusCode)
			continue
		}

		if resp.StatusCode != http.StatusOK {
			log.Printf("Gemini Error Status %d: %s\n", resp.StatusCode, string(body))
			return fmt.Sprintf("API Error (%d): %s", resp.StatusCode, string(body)), nil
		}

		var geminiResp GeminiResponse
		if err := json.Unmarshal(body, &geminiResp); err != nil {
			return "", err
		}

		if len(geminiResp.Candidates) > 0 && len(geminiResp.Candidates[0].Content.Parts) > 0 {
			return geminiResp.Candidates[0].Content.Parts[0].Text, nil
		}
	}

	return "The AI service is currently experiencing high demand across all models. Please try again in a few seconds.", nil
}
func handleChat(w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Println("Upgrade error:", err)
		return
	}
	defer conn.Close()

	for {
		messageType, msg, err := conn.ReadMessage()
		if err != nil {
			break
		}

		aiReply, err := callGemini(string(msg))
		if err != nil {
			log.Println("Gemini Error:", err)
			aiReply = "Error querying Gemini API."
		}

		if err := conn.WriteMessage(messageType, []byte(aiReply)); err != nil {
			break
		}
	}
}

func main() {
	http.HandleFunc("/ws", handleChat)
	fmt.Println("Go WebSocket Server running on :8080")
	log.Fatal(http.ListenAndServe(":8080", nil))
}