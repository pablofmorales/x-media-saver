### Requirement: Detect Reddit posts with media
The content script SHALL detect posts on reddit.com that contain images, galleries, or videos using the `<shreddit-post>` element.

#### Scenario: Image post detected
- **WHEN** a `<shreddit-post>` element contains an image hosted on `i.redd.it`
- **THEN** the system SHALL identify the post as containing image media

#### Scenario: Gallery post detected
- **WHEN** a `<shreddit-post>` element is a gallery post (contains multiple images)
- **THEN** the system SHALL identify the post as containing gallery media

#### Scenario: Video post detected
- **WHEN** a `<shreddit-post>` element contains a video player (`shreddit-player` or `<video>` element)
- **THEN** the system SHALL identify the post as containing video media

#### Scenario: Text-only post ignored
- **WHEN** a `<shreddit-post>` element contains no image, gallery, or video media
- **THEN** the system SHALL NOT inject a download button

### Requirement: Inject download button into Reddit posts
The content script SHALL inject a download button into each Reddit post's action bar when media is detected.

#### Scenario: Button placement
- **WHEN** a Reddit post with media is detected
- **THEN** a download button SHALL be injected into the post's action bar (the row containing upvote, comment, share buttons)

#### Scenario: Button not duplicated
- **WHEN** a Reddit post has already been processed and has a download button
- **THEN** the system SHALL NOT inject a second button

#### Scenario: Dynamic content
- **WHEN** new posts are loaded via infinite scroll or navigation
- **THEN** the system SHALL detect and process the new posts

### Requirement: Download Reddit images
The content script SHALL extract image URLs and send download requests to the background worker.

#### Scenario: Single image download
- **WHEN** the user clicks the download button on a post with a single image
- **THEN** the system SHALL send a `download-images` message with the full-resolution image URL and a filename of format `r-{subreddit}_{postId}.{ext}`

#### Scenario: Gallery download
- **WHEN** the user clicks the download button on a gallery post
- **THEN** the system SHALL send a `download-images` message with all gallery image URLs, each with filename `r-{subreddit}_{postId}_{index}.{ext}`

### Requirement: Download Reddit videos
The content script SHALL send video download requests to the background worker for posts containing video.

#### Scenario: Video download
- **WHEN** the user clicks the download button on a post with a video
- **THEN** the system SHALL send a `download-reddit-video` message with the post URL to the background worker

### Requirement: Content script registered for Reddit
The extension manifest SHALL include a content script entry for reddit.com.

#### Scenario: Script injection
- **WHEN** the user navigates to `https://www.reddit.com/*`
- **THEN** the Reddit content script SHALL be injected into the page

#### Scenario: Host permissions
- **WHEN** the extension is installed
- **THEN** the manifest SHALL include host permissions for `https://www.reddit.com/*`, `https://i.redd.it/*`, and `https://v.redd.it/*`

### Requirement: Extension identity updated for multi-platform
The extension name and description SHALL reflect support for multiple platforms.

#### Scenario: Extension name
- **WHEN** the extension is installed or viewed in chrome://extensions
- **THEN** the name SHALL be "Social Media Saver" and the description SHALL reference both X and Reddit
