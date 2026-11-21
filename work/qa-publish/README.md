# Retro Page publishing integration checks

Run the public-route regression with Node 22 or newer from the workspace root after building the member service.

```sh
python3 work/yestersites-edition/scripts/build.py
node work/qa-publish/check.mjs
```

The test uses the shipped browser preset and a freshly generated native Late Night Signal project. A disposable SQLite database runs all tracked migrations and emulates D1's transactional batch operation. Assertions cover claimed names, author ownership, rollback after child-page edits, rejection of partial updates, original image bytes, multi-edition navigation, listed-only discovery, guestbook submissions and concurrent counters.

To exercise the actual review UI, run `node work/qa-publish/local-review.mjs` and use its printed localhost URL with `python3 work/qa-publish/browser-handoff.py URL`. The fixture injects a test identity into its in-memory service. It never sends sample projects to the production publishing API.

To reuse the native desktop flow, use a display with Tk available and save the draft from `python3 work/qa-publish/desktop-handoff.py` to a temporary file. Run the same browser check with `RETRO_TEST_DESKTOP_DRAFT` set to that path. The test confirms publication, follows the Station Log link, imports and republishes a saved file, restores the preceding revision, and opens the restored homepage. Firefox, Python websockets, and Pillow and a desktop Tk runtime are required.
