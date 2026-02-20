## ADDED Requirements

### Requirement: Mixed-media tweets download all media types
When a tweet contains both images and a video, the extension SHALL download all media (images and video) in a single click, rather than prioritizing one type over another.

#### Scenario: Tweet with images and video
- **WHEN** a user clicks the save button on a tweet containing both images and a video
- **THEN** the extension SHALL send a `download-video` message AND a `download-images` message to the background service worker, initiating downloads for all media

#### Scenario: Tweet with only images
- **WHEN** a user clicks the save button on a tweet containing only images (no video)
- **THEN** the extension SHALL download all images, maintaining the existing behavior

#### Scenario: Tweet with only video
- **WHEN** a user clicks the save button on a tweet containing only a video (no images)
- **THEN** the extension SHALL download the video, maintaining the existing behavior

### Requirement: Loading state covers all downloads
The save button SHALL remain in the loading state until all triggered downloads (both images and video for mixed-media tweets) have been acknowledged by the background worker.

#### Scenario: Mixed-media loading state
- **WHEN** a user clicks save on a mixed-media tweet
- **THEN** the loading spinner SHALL remain visible until both the video download and image download responses have been received
