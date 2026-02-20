### Requirement: Resolve Reddit video URL via JSON API
The background worker SHALL resolve Reddit video download URLs by fetching post metadata from Reddit's JSON API.

#### Scenario: Successful video resolution
- **WHEN** a `download-reddit-video` message is received with a post URL
- **THEN** the background worker SHALL fetch `{postUrl}.json`, extract the `reddit_video.fallback_url` from the response, and initiate a download of the MP4 file

#### Scenario: Post has no video
- **WHEN** a `download-reddit-video` message is received but the JSON API response contains no `reddit_video` data
- **THEN** the background worker SHALL respond with an error and notify the user

#### Scenario: API request fails
- **WHEN** the Reddit JSON API request fails (network error or non-200 status)
- **THEN** the background worker SHALL respond with an error and notify the user

### Requirement: Reddit video filename convention
The downloaded video file SHALL use a consistent naming convention.

#### Scenario: Video filename
- **WHEN** a Reddit video is downloaded
- **THEN** the filename SHALL follow the format `r-{subreddit}_{postId}_video.mp4`
