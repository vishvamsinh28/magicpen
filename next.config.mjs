/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: [
    "mongodb",
    "mammoth",
    "html-to-docx",
    "@iarna/rtf-to-html",
    "unpdf",
  ],
};

export default nextConfig;
