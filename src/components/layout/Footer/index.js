import React from 'react';
import './index.css'
export default function Footer() {
  return (
    <footer className="footer-container">
      Data version: <span className="font-medium">...</span> (last change ...)…  
      <span className="mx-1">|</span>  
      Calculator version: <span className="font-medium">0.0.1</span>
      <br />
      Please send feedback, or{' '}
            <a
        className="underline text-primary-500 hover:text-primary-700"
        href="/newsletter-signup"
      >
        ...
      </a>.
    </footer>
  );
}
