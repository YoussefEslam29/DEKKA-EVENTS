"use client";

import Link from "next/link";
import { useI18n } from "@/components/I18nProvider";

/**
 * "I agree to the [Terms & Conditions] and [Privacy Policy]" as three
 * translated fragments around two real links, rather than links embedded in a
 * single translated string — which would mean either parsing markup out of the
 * dictionary or duplicating the sentence per language in JSX.
 *
 * Both links open in a new tab. That's a deliberate exception to this app's
 * same-tab `<Link>` norm: every place this renders sits next to a form holding
 * typed input (name, phone, email, a pitch), and navigating away in-place to
 * read a policy would throw it all away.
 */
export function ConsentText({
  prefix,
  withTerms = true,
}: {
  prefix: string;
  /** False for the reserve-button note, which only cites the privacy policy. */
  withTerms?: boolean;
}) {
  const { t } = useI18n();
  // Underlined always, not just on hover: these sit mid-sentence, where
  // colour alone is the one cue a colour-blind reader may not get (1.4.1).
  const linkClass = "font-semibold text-gold-accent underline";

  return (
    <>
      {prefix}
      {withTerms ? (
        <>
          <Link href="/terms" target="_blank" rel="noopener noreferrer" className={linkClass}>
            {t.legal.consent.termsLink}
          </Link>
          {t.legal.consent.and}
        </>
      ) : null}
      <Link href="/privacy" target="_blank" rel="noopener noreferrer" className={linkClass}>
        {t.legal.consent.privacyLink}
      </Link>
    </>
  );
}
