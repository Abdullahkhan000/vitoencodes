export type FAQItem={id:string;category:string;question:string;answer:string;contact?:boolean;source?:{label:string;url:string}};
export const faqItems:FAQItem[]=[
  {
    "id": "open-matte",
    "category": "Formats & picture",
    "question": "What is Open Matte?",
    "answer": "Open Matte presents picture area above and below a narrower widescreen crop when that extra image exists in the source. It is not made by stretching the picture or simply removing black bars. The available framing depends on the master, and some versions may also crop the sides. More visible image does not automatically mean the filmmaker preferred that composition.",
    "source": {
      "label": "Film Atlas: matting and film formats",
      "url": "https://www.filmatlas.com/entry/161"
    }
  },
  {
    "id": "imax",
    "category": "Formats & picture",
    "question": "What does IMAX mean on an encode?",
    "answer": "IMAX is a cinema presentation system and brand. On a home-video release, the label often refers to an edition containing expanded-aspect-ratio footage. Common IMAX ratios include 1.90:1 and, for certain presentations, 1.43:1. Only some scenes may expand, and a home encode does not automatically contain the full theatrical IMAX frame or every IMAX feature. Check the specific release rather than assuming the label guarantees one ratio.",
    "source": {
      "label": "IMAX: expanded framing",
      "url": "https://www.imax.com/news/IMAX-Presents-Avengers-Infinity-War-the-Russo-Brothers"
    }
  },
  {
    "id": "35mm",
    "category": "Formats & picture",
    "question": "What is a 35mm release?",
    "answer": "35mm describes the width of motion-picture film, not a digital resolution or a fixed aspect ratio. In an encode catalog, a 35mm label usually identifies material associated with a film scan; the release notes should specify its provenance. A scan can preserve grain and characteristics of the film element, but its appearance also depends on the element, scanner, grading and processing. A 35mm label alone does not mean an untouched theatrical print or better quality than every digital master.",
    "source": {
      "label": "Kodak: motion-picture film scanning",
      "url": "https://www.kodak.com/en/motion/page/kodak-film-labs/"
    }
  },
  {
    "id": "format-comparison",
    "category": "Formats & picture",
    "question": "Are Open Matte, IMAX and 35mm the same thing?",
    "answer": "No. Open Matte describes framing, IMAX identifies a cinema system or associated presentation, and 35mm describes a film gauge. They are different properties and can overlap. None of these labels alone tells you the codec, resolution, color grade or overall quality."
  },
  {
    "id": "custom-release",
    "category": "Custom releases",
    "question": "What is a custom VITOENCODES release?",
    "answer": "A custom release is an encoder-prepared edition rather than simply a label for a higher resolution. Depending on its documented notes, it can involve a particular source or cut, a hybrid of compatible sources, adjusted color, or selected audio and subtitle tracks. The filename and release details identify what is available for that encode; a custom tag alone does not establish which processing steps were used."
  },
  {
    "id": "custom-workflow",
    "category": "Custom releases",
    "question": "How is a custom release put together?",
    "answer": "The general workflow starts with identifying the source and edition, deciding the intended framing and output, and preparing any video, audio or subtitle work needed for that edition. Where multiple sources are used, their cuts, timing and framing must be checked for compatibility. The result is encoded or packaged with its selected tracks and checked for playback and synchronization. This explains a typical custom-release workflow; the exact VITOENCODES steps and tools need the encoder's own release notes."
  },
  {
    "id": "hybrid",
    "category": "Custom releases",
    "question": "What do HYBRID, RE-GRADED and HDR-to-SDR mean?",
    "answer": "HYBRID generally indicates that an edition combines material from more than one source; the label alone does not identify the combination. RE-GRADED indicates an intentional color adjustment, which is not necessarily an official restoration. HDR-to-SDR describes adapting high-dynamic-range video for an SDR presentation. These are different operations: use the release notes and screenshots to understand the particular edition."
  },
  {
    "id": "best-format",
    "category": "Playback & quality",
    "question": "Which format should I choose?",
    "answer": "Choose the edition whose framing, source and technical specifications match what you want to watch. Open Matte may offer a taller frame; an IMAX edition may include expanded sequences; a film-sourced edition may retain a different texture. Compare screenshots, resolution, codec, audio and file size. A larger file or a special format tag is not an automatic guarantee of a better presentation."
  },
  {
    "id": "help-0",
    "category": "Downloads",
    "question": "How do I download an encode?",
    "answer": "Open a movie, choose a release under Download options, then select a mirror. The provider opens in a new tab; use its download option. Torrent magnets require a torrent client.",
    "contact": false
  },
  {
    "id": "help-1",
    "category": "Custom releases",
    "question": "Why are there multiple releases for one movie?",
    "answer": "A film may have different resolutions, sources, cuts, codecs or formats. These versions share one movie page, with a separate filename, size and mirrors for each encode.",
    "contact": false
  },
  {
    "id": "help-2",
    "category": "Downloads",
    "question": "What if a download link is broken?",
    "answer": "Try another mirror on the same release, then report the affected page and mirror through Contact. Include the filename and the error you see so the right release can be checked.",
    "contact": true
  },
  {
    "id": "help-3",
    "category": "Formats & picture",
    "question": "What do Blu-Ray, HDTV and WEB-DL mean?",
    "answer": "These describe the source named in the encode filename. WEBRip releases also appear under WEB-DL. IMAX, Open Matte and 35mm are separate format filters.",
    "contact": false
  },
  {
    "id": "help-4",
    "category": "Playback & quality",
    "question": "What is the difference between 4K, 1080p and HEVC?",
    "answer": "4K/2160p and 1080p describe resolution. HEVC/x265, H.264/x264 and AV1 describe video codecs. Check that your player supports the codec and audio format listed for your chosen release.",
    "contact": false
  },
  {
    "id": "help-5",
    "category": "The archive",
    "question": "Can I stream movies here?",
    "answer": "This is an encode catalog with external download mirrors. It does not provide an on-site streaming player.",
    "contact": false
  },
  {
    "id": "help-6",
    "category": "The archive",
    "question": "How do search and filters work?",
    "answer": "Combine words such as Dune 2024 IMAX or 4K HEVC. Search also matches filenames, genres, cast and encoder tags. Search covers the full library before pagination; clear filters if you cannot find a title.",
    "contact": false
  },
  {
    "id": "help-7",
    "category": "The archive",
    "question": "Where are my saved movies stored?",
    "answer": "Bookmarks are saved in this browser on this device. Clearing browser storage removes them, and they do not automatically sync to other devices.",
    "contact": false
  },
  {
    "id": "help-8",
    "category": "The archive",
    "question": "What do Added and Updated dates mean?",
    "answer": "Added is when the encode entered this catalog. Updated is its latest recorded change, including metadata or mirror edits. Times display in Pakistan Standard Time (PKT). Older records without update history show Not recorded.",
    "contact": false
  },
  {
    "id": "help-9",
    "category": "Formats & picture",
    "question": "Are movie stills screenshots from the encode?",
    "answer": "Not always. Images supplied by the movie metadata provider are labelled as movie stills. Screenshots attached to a particular encode are displayed for that selected version.",
    "contact": false
  },
  {
    "id": "help-10",
    "category": "Downloads",
    "question": "Why is a download slow or unavailable?",
    "answer": "Downloads run through the external provider, which controls its availability, speed and account requirements. Try another available mirror and report persistent issues.",
    "contact": false
  },
  {
    "id": "help-11",
    "category": "The archive",
    "question": "How can I contact VITOENCODES?",
    "answer": "Use the Contact page to submit a private message or issue report. It goes to the site owner’s admin inbox. An email is optional, but include one if you want the owner to be able to contact you.",
    "contact": true
  }
];
