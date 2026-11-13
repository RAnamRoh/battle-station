# Fighter art with Gemini (Nano Banana): style, likeness, prompts, tests

*Research as of 2026-11-14. Items marked "unverified" come from third-party sources; check them yourself.*

## 0. Models and the free tier

| Name | API ID | Notes |
|---|---|---|
| Nano Banana 2.1 | `gemini-nano-banana-2.1` | Newest (about 6 Oct 2026). Better "consistency across turns". One source says it is paid-only in the app (unverified). |
| Nano Banana 2 | `gemini-3.1-flash-image` | Stable. The model free users get in the Gemini app. |
| Nano Banana 2 Lite | `gemini-3.1-flash-lite-image` | Not built for reference images or repeated edits. **Don't use.** |
| Nano Banana Pro | `gemini-3-pro-image` | Up to 5 character references plus 3 style references. |

Source: https://aistudio.google.com/docs/models

**What is free:**
- **API:** no free tier for any image model (https://aistudio.google.com/docs/pricing).
- **Gemini app:** free accounts get "standard limits". Third-party guides say about 20 images a day (unverified).
- **Image-to-video:** don't count on any free option. Make key poses as images and fill the in-between frames in the game engine.
- **$0 approach:** use the Gemini app by hand, with Nano Banana 2.

**How consistent Gemini really is:**
- Google itself says "character consistency across edits may vary".
- Independent tests rate Nano Banana mid-pack on keeping a face the same.
- **Things on one side of the body flip to whichever side faces the camera.** For example, an earring moved from the left ear to the right ear in 7 of 7 tests (https://www.jxp.com/nano-banana/blog/nano-banana-2-1-character-consistency).
- Each edit redraws the whole image, so details you didn't touch slowly drift.

**What this means for us:** game sprites get mirrored anyway, so tell people apart by **symmetric** features. Never rely on a watch worn on one wrist or which side the hair is parted.

## 1. Styles compared (1–5)

| Style | Likeness | Gemini consistency | Easy to animate | Fits a fighting game | Risk of bearded men looking alike |
|---|---|---|---|---|---|
| **A. Cel-shaded comic, mild caricature** (thick ink outline, flat colour + 1 hard shadow tone, about 7 heads tall) | 4 | 4 | 5 | 5 | Low |
| B. Big-head / chibi | 4 | 4 | 4 | 2 | Medium |
| C. Semi-realistic painted | 5 on one image | 2 | 1 | 3 | Low on the master, but detail is lost at sprite size |
| D. Graphic-novel heavy blacks | 3 | 4 | 4 | 4 | **High: beards, hair and shadows merge into one black mass** |
| E. 16-bit-style painted, made directly by the model | 3 | 2–3 | 4 | 5 | Medium |

**Recommendation:** have Gemini draw style **A** on a flat background. Then add the retro "16-bit painted" feel ourselves in code: shrink the image to about 240 px and lock each fighter to a fixed set of colours. Never ask the model for pixel or dither texture, because it draws that differently in every frame.

## 2. Making each person recognisable

**Caricature principle:** people recognise exaggerated drawings at least as well as accurate ones. For each person, push 2–3 features by about 10–25% **away from the rest of your roster**. If everyone has a full beard, beard length doesn't help tell people apart. Nose, brows, glasses, hairline or build might.

**Roster distinctness table:** fill this in before generating anything. Every fighter must be unique on at least 3 of these 5 channels:
1. **Silhouette and build:** tall-lean, short-stocky, broad-heavy, wiry, belly. This is the strongest cue at sprite size.
2. **Head and hair shape:** bald or receding, flat-top, swept volume, short crop, cap, headband.
3. **Beard shape**, using the vocabulary below.
4. **Signature outfit colour:** one per fighter, each in a different hue.
5. **Prop or accessory:** glasses, lanyard ID badge, rolled sleeves, scarf, sandals vs sneakers, a laptop bag used as a weapon. Keep these symmetric where possible.

**Beard vocabulary:**
- **Moustache:** yes or no. A full beard with a shaved upper lip is very distinctive.
- **Outline:** boxed, rounded, pointed, squared, chin-strap, goatee, chin-only.
- **Length:** stubble, short, fist-length, long.
- **Density:** dense, patchy, thin.
- **Cheek line:** high or low.
- **Colour:** black, dark brown, salt-and-pepper, grey at the chin, henna orange-red.

**Rule:** draw the beard as a shaped colour mass with its own shadow tone, never as pure black.

**Identity sheet per person:** paste it into every prompt, and never use the person's real name.

```
IDENTITY — Fighter #07
Face shape: long oval, narrow jaw | Forehead: high, receding at temples
Eyes: deep-set, slightly downturned | Brows: thick, straight, nearly joined
Nose: long, prominent bridge, wide rounded tip | Mouth: full lower lip, mostly hidden by moustache
Beard: full beard WITHOUT moustache, ~2 fingers below chin, squared bottom edge, dense chin,
  patchy upper cheeks, grey streaks at chin centre
Hair: short, side-parted, thinning crown, grey at sideburns
Skin: medium-brown, warm (#8A5A3C base / #63402A shadow)
Glasses: thin rectangular gold frames
Build: tall, lean, slightly rounded shoulders, long arms
Signature colour: teal (#1E8C8C) jacket over white shirt; dark trousers
Prop: lanyard ID badge, white sneakers
Caricature push: +20% nose length, +15% brow weight, +10% height/limbs
Default expression: calm, slight smirk
```

**How to get Gemini to keep these features:**
- **Give each reference image a job:** "Image 1 = face, Image 2 = three-quarter, Image 3 = body". This follows Google's prompting guides.
- **Upload 2–3 photos:** front, three-quarter and full body, in even light, with no sunglasses.
- **Approve one "master" image, then edit from it.** Every pose starts from the master plus the turnaround sheet, never from the previous frame, because chained edits drift.
- **Use a pose reference:** a stick figure, a mannequin, or a photo of anyone striking the pose.
- **Make one change per edit,** and start a fresh chat for each person.
- **Use Google's edit wording:** "change only X… keep everything else exactly the same".
- **Watch out for refusals.** Naming real people, face-swapping, or changing a real photo's clothes often gets refused (unverified). Instead, first ask for "an illustrated fighter based on this person", then do all later edits on the illustration.
- **No blood or gore,** which is against Gemini's policy.
- **Background:** a flat magenta (#FF00FF) background, which we remove later; don't ask for "transparent". Generate the fighter facing right only, and mirror it in the engine.

## 3. Prompt templates

**Fixed style block.** Paste this word-for-word every time:

```
STYLE: early-1990s arcade brawler character art, American comic-book look. Thick uniform black ink
outline around the whole figure and major forms; interior lines thinner. Flat colour fills with exactly
one hard-edged shadow tone per colour (cel shading) and a small hard highlight on hair, beard and cheekbones.
Limited palette, saturated but not neon. Light from upper left. Side-view fighting-game proportions,
about 7 heads tall, slightly heroic. Mild caricature: exaggerate the listed distinctive features, keep
everything else natural. Background: one perfectly flat solid magenta (#FF00FF) colour, no floor, no shadow
on the ground, no texture, nothing else in frame. Full body visible with empty margin around it.
```

**(a) Photos → master image**

```
Create an original fighting-game character illustration based on the person in images 1–3.
Image 1 = face reference (front). Image 2 = face reference (three-quarter). Image 3 = body/build reference.
[Image 4 = style reference only: copy its line weight, shading and colour treatment, NOT its face or body.]

Goal: a game sprite master where coworkers instantly recognise this specific person.
Preserve exactly from the photos: face shape, eye shape and spacing, brow shape, nose shape, beard outline,
beard length and density, moustache presence, hairline, skin tone, glasses, body build and height.
[IDENTITY]
Pose: neutral fighting stance facing right, side view turned 3/4 toward camera, fists raised, knees bent,
weight on back leg. Calm confident expression.
Outfit: [signature outfit in signature colour].
[STYLE]
Draw the beard as a shaped dark-brown colour mass with its own shadow tone and visible outline, clearly
separate from the hair; keep the face readable, eyes clearly visible.
Avoid: generic or average face, smoothing away asymmetries, changing the beard shape, adding a moustache
he doesn't have, photorealistic rendering, soft gradients, airbrushing, painterly texture, scenery, text,
logos, extra people, drop shadows, glow.
```

Generate 4–8 candidates. The person and 2 coworkers pick the best one. Then fix one feature per edit:
`In this image change only the nose: make it [longer / wider at the tip]. Keep everything else exactly the same.`

**Turnaround sheet**

```
Using image 1 as the exact character, create a character model sheet on the same flat magenta background:
five full-body views in a row at identical scale — front, three-quarter front, side (facing right),
back, side (facing left). Same face, beard outline, glasses, colours, line weight and shading as image 1.
Neutral standing pose, arms slightly away from body. No labels or text.
```

**(b) Master → a pose.** Image 1 = master, image 2 = turnaround sheet, image 3 = pose reference.

```
Image 1 is the character (identity and style master). Image 2 shows the same character from other angles.
Image 3 shows the POSE ONLY — ignore its body, face, clothes and drawing style.
Redraw the character from image 1 in the pose from image 3: [move description]. Facing right.
Keep completely unchanged: face, beard outline/length/greying, moustache (or its absence), glasses,
hairline, skin tones, body proportions, outfit, colours, outline thickness, shading style, and scale
(same height as image 1). [IDENTITY — 5–6 key lines]
Flat solid magenta (#FF00FF) background, full body in frame with margin, nothing else in the image.
Avoid: new accessories, changed clothing details, motion blur, speed lines, impact effects, gradient
shading, scenery, floor shadow, a second character.
```

Make only the key poses (wind-up, hit, recovery). The engine handles in-between frames, sparks and effects.

**(c) Master → super-move close-up**

```
Using image 1 as the exact character, create a dramatic close-up bust portrait for a special-move cut-in:
head and shoulders, three-quarter view, slight low angle, intense determined expression, shouting.
Keep the face, beard outline and greying pattern, moustache, glasses, hairline, skin tones, outfit
colour and ink-and-cel style exactly as in image 1; caricature features stay exaggerated the same amount.
[IDENTITY — face lines only] Background: flat solid [signature colour] with a few bold diagonal
light-coloured stripes. Wide 16:9 framing, character on the right half. No text.
Avoid: soft painterly rendering, realistic photo lighting, changing facial proportions.
```

**Never put any of these in a prompt:** a franchise, studio, artist or game name; a real name; "make him look like [celebrity]"; gore; face-swaps.

## 4. Free test protocol (Google Forms)

**Recognition test:**
- Show each fighter on its own at real game size (240 px), in random order.
- List every fighter's name plus 2–3 names of people who aren't in the game, so raters can't guess by elimination.
- Use at least 10–15 raters who know the people.
- **Pass bar:** at least 80% correct at sprite size, and at least 90% for the close-up portraits.
- If two fighters get mixed up more than 15–20% of the time, they are a "collision pair".

**Look-alike checks:**
- **Odd-one-out:** show 3 fighters and ask "which two look most alike?" If the same two bearded men keep getting picked together, they are converging.
- **Silhouette:** show only black silhouettes. Can raters still name them?
- **Greyscale:** remove the colour. Recognition shouldn't depend on outfit colour alone.

**Fixing a collision pair:** change one channel per fighter (build, beard shape, hair or colour), then retest only that pair. Also get the person's own OK on their fighter.

**Frame-consistency check:** put all frames on one contact sheet next to the master. Regenerate any frame where the beard, glasses or hairline drifted, starting from the master.

## 5. Rules and law

**Google's rules:**
- Google's Generative AI Prohibited Use Policy bans using personal data without legally required consent and deceptive impersonation. Consented, clearly labelled caricature of coworkers is fine (https://policies.google.com/terms/generative-ai/use-policy).
- The Gemini app asks you to get permission before using other people's faces. Turn **Keep Activity off**, which keeps chats for 72 hours and doesn't use them for training.
- The free AI Studio and API terms say not to submit personal information, so use the Gemini app.

**Watermarks:**
- Every image carries an invisible SynthID mark plus content-credential (C2PA) metadata.
- The visible sparkle watermark sits in a corner. It disappears when we remove the background and crop.
- Since August 2026 there is a setting to turn the sparkle off, but whether it appears in Bangladesh is unverified.
- Add "Art generated with Google Gemini" to the credits.

**Bangladesh law:**
- The **Personal Data Protection Act 2026** was passed on 9 Apr 2026 (https://www.bssnews.net/js-session/376218). Most of it applies from November 2025. Fines and complaints start around May 2027 (secondary sources).
- Consent must be informed, explicit, specific and withdrawable. Biometric data is "sensitive"; whether ordinary photos count is unclear.
- **What to do:** get a short signed consent from each person. It should cover the purpose, that the photos are processed by Google outside Bangladesh, deletion of the source photos once the fighter is approved, and the right to withdraw.

## 6. Ranking

1. **A, cel-shaded comic with mild caricature, with the retro look added by us in post-processing.** This is the pick.
2. E, 16-bit painted made by the model. Use it only as the target look for that post-processing.
3. B, big-head. Good for select-screen icons or a joke costume.
4. C, semi-realistic. Use it only for a title-screen splash image.
5. D, graphic-novel blacks. **Avoid**, because bearded men end up looking alike.

**Time per fighter:** about 20 free images a day per account (unverified) means about 3–4 days per fighter. It goes faster if each coworker generates on their own Gemini account, which also keeps consent with them.

**Still to check yourself:** the actual daily quota, whether 2.1 or Pro is free on your account, whether the watermark toggle appears in Bangladesh, whether Gemini refuses edits to real photos, and the official text of the Act.
