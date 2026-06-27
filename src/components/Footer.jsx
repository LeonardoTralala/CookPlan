import { Logo } from "./Logo.jsx";

import { Link } from "react-router-dom";

const links = ["Tentang Kami", "Bantuan", "Kebijakan Privasi", "Syarat dan Ketentuan"];

export function Footer() {
  return (
    <footer className="w-full mt-auto bg-surface-container-highest border-t border-outline-variant/30">
      <div className="w-full px-margin-mobile md:px-margin-desktop py-12 flex flex-col md:flex-row justify-between items-center max-w-container-max mx-auto gap-8">
        <div className="flex items-center gap-3 select-none">
          <Logo className="h-9 w-auto" />
        </div>
        <div className="flex flex-wrap justify-center gap-6 md:gap-8">
          {links.map((label) => {
            let toPath = "/";
            if (label === "Tentang Kami") toPath = "/about";
            else if (label === "Bantuan") toPath = "/help";
            else if (label === "Kebijakan Privasi") toPath = "/privacy";
            else if (label === "Syarat dan Ketentuan") toPath = "/terms";

            return (
              <Link
                key={label}
                to={toPath}
                className="font-label-sm text-label-sm text-on-surface-variant hover:text-primary transition-colors cursor-pointer inline-flex items-center py-3"
              >
                {label}
              </Link>
            );
          })}
        </div>
        <p className="font-label-sm text-label-sm text-on-surface-variant/60">
          © 2026 CookPlan. Hak Cipta Dilindungi.
        </p>
      </div>
    </footer>
  );
}
