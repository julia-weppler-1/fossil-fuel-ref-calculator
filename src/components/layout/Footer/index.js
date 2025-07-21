import React from 'react';
import './index.css'
export default function Footer() {
  return (
    <footer className="footer-container">
      Data version: <span className="font-medium">7.4</span> (last change 12 Nov 2024)…  
      <span className="mx-1">|</span>  
      Calculator version: <span className="font-medium">3.0.1</span>
      <br />
      Please send feedback, or{' '}
            <a
        className="underline text-primary-500 hover:text-primary-700"
        href="/newsletter-signup"
      >
        sign-up to the newsletter
      </a>.
    </footer>
  );
}
