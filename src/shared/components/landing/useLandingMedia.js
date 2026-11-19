import { useEffect, useState } from 'react';
import { api } from '../../../pages/publicApi.js';

// Admin Gallery Management images, grouped by category (e.g. 'landing-hero',
// 'landing-tours'). Every landing section calls this hook, so the GET
// /gallery request is shared: one fetch per page load, not one per section.
let mediaPromise = null;

function groupByCategory(result) {
  const next = {};
  (result?.gallery || result?.items || []).forEach((item) => {
    const key = item.category || item.type;
    // Items without an image are kept too — a Signature Tours card slot can
    // override just its text. Every consumer falls back on an empty imageUrl.
    if (key) next[key] = [...(next[key] || []), { ...item, imageUrl: item.imageUrl || item.image_url || '' }];
  });
  return next;
}

function loadLandingMedia() {
  if (!mediaPromise) {
    mediaPromise = api
      .get('/gallery')
      .then(groupByCategory)
      .catch(() => {
        mediaPromise = null; // let the next mount retry
        return {};
      });
  }
  return mediaPromise;
}

// `{ media, loaded }` — `loaded` lets a section hold off on its /public
// fallback image until it knows whether the admin uploaded one, instead of
// flashing the fallback first and then swapping it out.
export function useLandingMediaState() {
  const [state, setState] = useState({ media: {}, loaded: false });

  useEffect(() => {
    let active = true;
    loadLandingMedia().then((media) => {
      if (active) setState({ media, loaded: true });
    });
    return () => {
      active = false;
    };
  }, []);

  return state;
}

export function useLandingMedia() {
  return useLandingMediaState().media;
}
