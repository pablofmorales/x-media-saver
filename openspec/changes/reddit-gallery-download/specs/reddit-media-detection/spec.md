## MODIFIED Requirements

### Requirement: Download Reddit images
The content script SHALL extract image URLs and send download requests to the background worker.

#### Scenario: Single image download
- **WHEN** the user clicks the download button on a post with a single image
- **THEN** the system SHALL send a `download-images` message with the full-resolution image URL and a filename of format `r-{subreddit}_{postId}.{ext}`

#### Scenario: Gallery download via DOM
- **WHEN** the user clicks the download button on a gallery post and image URLs are found in the DOM
- **THEN** the system SHALL send a `download-images` message with all found image URLs, each with filename `r-{subreddit}_{postId}_{index}.{ext}`

#### Scenario: Gallery download via API fallback
- **WHEN** the user clicks the download button on a gallery post and no image URLs are found in the DOM
- **THEN** the system SHALL send a `download-reddit-gallery` message to the background worker with the post URL, subreddit, and postId for API-based resolution

#### Scenario: Mixed-media post download
- **WHEN** the user clicks the download button on a post containing both video and gallery/image media
- **THEN** the system SHALL send both a `download-reddit-video` message for the video AND a `download-reddit-gallery` (or `download-images`) message for the images
