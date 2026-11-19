import { useEffect, useState } from 'react';
import DOMPurify from 'dompurify';
import { Link } from 'react-router-dom';
import { Footer } from '../shared/components/landing/sections/Footer.jsx';
import { Navbar } from '../shared/components/landing/sections/Navbar.jsx';
import { api } from './publicApi.js';

const POLICIES = {
  terms: { title: 'Terms & Conditions', endpoint: 'terms' },
  privacy: { title: 'Privacy Policy', endpoint: 'privacy' },
  disclaimer: { title: 'Disclaimer', endpoint: 'disclaimer' },
  refund: { title: 'Refund Policy', endpoint: 'refund' },
};

export default function LegalPage({ policy }) {
  const document = POLICIES[policy] || POLICIES.terms;
  const [state, setState] = useState({ loading: true, html: '', error: '' });

  useEffect(() => {
    let active = true;
    setState({ loading: true, html: '', error: '' });
    api.get(`/site-terms/${document.endpoint}`).then(({ terms }) => {
      if (active) setState({ loading: false, html: terms?.body_html || '', error: '' });
    }).catch((error) => {
      if (active) setState({ loading: false, html: '', error: error.message || 'Unable to load this policy.' });
    });
    return () => { active = false; };
  }, [document.endpoint]);

  return (
    <div className="min-h-screen bg-[#F8F5EF] text-[#1B2333]">
      <Navbar />
      <main className="mx-auto max-w-4xl px-6 py-14 sm:px-10 sm:py-20">
        <Link to="/" className="text-xs font-semibold text-[#80601B] hover:underline">Back to Home</Link>
        <h1 className="mt-5 font-serif text-4xl sm:text-6xl">{document.title}</h1>
        {state.loading ? <p className="mt-8 text-sm text-[#59616D]">Loading...</p> : state.error ? <p className="mt-8 text-sm text-red-600">{state.error}</p> : <article className="mt-8 space-y-4 text-sm leading-7 text-[#59616D] [&_a]:text-[#80601B] [&_a]:underline [&_h2]:mt-8 [&_h2]:font-serif [&_h2]:text-2xl [&_h2]:font-semibold [&_h2]:text-[#1B2333] [&_h3]:mt-6 [&_h3]:font-semibold [&_h3]:text-[#1B2333] [&_li]:ml-5 [&_li]:list-disc" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(state.html || '<p>This policy has not been published yet.</p>') }} />}
      </main>
      <Footer />
    </div>
  );
}
