import { Helmet } from "react-helmet-async";

const SITE_NAME = "AgenticHR";
const BASE_URL = "https://agentichr.dev";
const DEFAULT_OG_IMAGE = `${BASE_URL}/og-image.jpg`;

interface SEOHeadProps {
  title: string;
  description: string;
  path?: string;
  ogImage?: string;
  noindex?: boolean;
}

export default function SEOHead({ title, description, path = "/", ogImage = DEFAULT_OG_IMAGE, noindex = false }: SEOHeadProps) {
  const url = `${BASE_URL}${path}`;
  const fullTitle = path === "/" ? title : `${title} | ${SITE_NAME}`;

  return (
    <Helmet>
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={url} />
      {noindex && <meta name="robots" content="noindex, nofollow" />}

      <meta property="og:type" content="website" />
      <meta property="og:url" content={url} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={ogImage} />
      <meta property="og:site_name" content={SITE_NAME} />

      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={ogImage} />
    </Helmet>
  );
}
