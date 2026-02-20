## ADDED Requirements

### Requirement: Resolve gallery image URLs via Reddit JSON API
The background worker SHALL resolve all image URLs for a Reddit gallery post by fetching `{postUrl}.json` and extracting URLs from the `media_metadata` field, ordered by `gallery_data.items`.

#### Scenario: Successful gallery resolution
- **WHEN** a `download-reddit-gallery` message is received with a valid post URL
- **THEN** the background worker SHALL fetch `{postUrl}.json`, extract image URLs from `media_metadata[id].s.u` for each item in `gallery_data.items`, decode HTML entities in the URLs, and initiate a download for each image

#### Scenario: Gallery with ordered items
- **WHEN** the JSON API response contains `gallery_data.items` with multiple media IDs
- **THEN** the images SHALL be downloaded in the order specified by `gallery_data.items`, with filenames following the format `r-{subreddit}_{postId}_{index}.{ext}`

#### Scenario: Missing gallery data
- **WHEN** the JSON API response contains no `gallery_data` or `media_metadata`
- **THEN** the background worker SHALL respond with an error and notify the user

#### Scenario: API request fails
- **WHEN** the Reddit JSON API request fails (network error or non-200 status)
- **THEN** the background worker SHALL respond with an error and notify the user

### Requirement: Gallery download message type
The extension SHALL support a `download-reddit-gallery` message type for requesting gallery downloads.

#### Scenario: Message format
- **WHEN** a gallery download is requested
- **THEN** the message SHALL include `type: "download-reddit-gallery"`, `postUrl` (full Reddit URL), `subreddit`, and `postId`

### Requirement: Gallery image filename convention
Downloaded gallery images SHALL use a consistent naming convention.

#### Scenario: Gallery image filenames
- **WHEN** gallery images are downloaded
- **THEN** each filename SHALL follow the format `r-{subreddit}_{postId}_{index}.{ext}` where index is 1-based and ext is derived from the image URL
