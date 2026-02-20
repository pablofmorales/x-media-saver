## 1. Full Media Download

- [x] 1.1 Modify `src/content/button.ts` click handler to send both `download-video` and `download-images` messages when a tweet contains both video and images (remove the early `return` at line 87 and restructure the flow)
- [x] 1.2 Update the loading state logic so the spinner stays active until both download responses are received for mixed-media tweets
- [x] 1.3 Manually test with image-only, video-only, and mixed-media tweets to verify all media downloads

## 2. Project README

- [x] 2.1 Create `README.md` at project root with project overview and features section
- [x] 2.2 Add installation instructions (clone, install, build, load as unpacked extension)
- [x] 2.3 Add development section with `npm run dev` and `npm run build` commands
- [x] 2.4 Add architecture section covering the three runtime contexts (background, content script, popup) and message-passing flow
