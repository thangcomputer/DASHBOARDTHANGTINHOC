# Chat sticker assets

Copy first-party transparent PNG files into `client/public/stickers/`. Register each sticker in `shared/messaging/chatStickers.json` with an ID matching its filename, display name, category, public URL, and search keywords. The shared catalog is used by both the chat UI and server-side send validation.

Catalog entries can be prepared before their images arrive. Stickers without a loadable image stay hidden in the picker and do not show a broken-image placeholder in messages. Keep existing root-level SVG assets in place: older deployments and messages may still refer to them.
