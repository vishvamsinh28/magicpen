/** @type {import('next').NextConfig} */
const nextConfig = {
  devIndicators: false,
  serverExternalPackages: [
    "mongodb",
    "mammoth",
    "html-to-docx",
    "@iarna/rtf-to-html",
    "unpdf",
  ],
};

export default nextConfig;
