/** @type {import('next').NextConfig} */
const nextConfig = {
    experimental: {
        serverActions: {
            allowedOrigins: ['localhost:3000'],
        },
    },
    images: {
        remotePatterns: [
            {
                protocol: 'https',
                hostname: 'plaid-merchant-logos.plaid.com',
                port: '',
            },
        ],
    },
};

export default nextConfig;
