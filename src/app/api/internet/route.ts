/* eslint-disable */
import { NextRequest, NextResponse } from "next/server";

const apiKeys = [
    'jina_cd46563371e54ac8bcd57b35ad825e31TFJIOITT_dugLiKWgGjzJcmwfPmZ',
    'jina_be24e87d07864128b145552ee0d19e86kCYx-KYuVmDsYD9WRd0p4RdBkoTk',
    'jina_00aa8fda4c0a41f6a5a4a200516bcd37RZcjFP5OFSl3DFHeG_QCI-naK4HK',
    'jina_4481a5c5ffdc46d880f69fbf40efefd8R-Ha02lUysLVNqxBelgiXUmGgRfU',
    'jina_7520de7b47bb40ae8a67e7d60ea201d3eZAisQecG1ZWMQ21naJCEfJCNnAx',
    'jina_66c26a3304434dbd9bd467a7c03a7983_P3_79qFP8BYXXy2fIrJ6MxDgUBA',
    'jina_57f514826cdc4b9f96f5be2f56003c14gNrJ1JXtqEte-CLB8OPqP_25SWE7',
    'jina_8c92aa0072944a0586b2572eb612e423Q2g-iY4F7aj_QljZbDFRyM4h_ydw',
    'jina_942d189edc3145d6b0d484ff0377088eFYfRNy3YqqyWo1pD-zvIK3VH8fWo',
    'jina_671c4a3419b145b390dbd6ff575b2c0e36iXONCUbGmDBb5h00kAbJB0YsDd',
    'jina_9a2d471143884cffb217497bdf4c9e67R7_9ndgxVD_M49GzXyZgQGLWoA_v',
    'jina_64956bb5095944cf8961ee44bcdcdf708T0QWCaGqUd7XBU05OPSzGz8--qu',
    'jina_2374fe47ca75492aa43d8413dfee8f2fl96K7FH8oswlLIylBcsPQpnz2BQp',
    'jina_247d547610a642ac949f9c6ee73aa4cd650-GrtdYTWz3p-YI4gyKZazKDMV',
    'jina_ad059114231d4f71b8fec178c5e44cf9gO3LL-TSLmot_-u236SJQW7lzlCh',
    'jina_3909f762ceb946d09b310db0545cec237bJXKkxD-XnaqZE42JQL73zRRUk8'
]

// Function to perform a search query on Jina API with retry logic
const searchJinaAPI = async (query: string, retries = 2): Promise<string[]> => {
    let failedInstances: string[] = [];

    for (let attempt = 0; attempt <= retries; attempt++) {
        try {
            const params = new URLSearchParams({
                q: query,
                format: "json",
            });

            const response = await fetch(`https://api.jina.ai/search?${params.toString()}`, {
                method: "GET",
                headers: { "Accept": "application/json", "Authorization": `Bearer ${apiKeys[Math.floor(Math.random() * apiKeys.length)]}` },
            });

            if (!response.ok) {
                throw new Error(`Failed to fetch from Jina API`);
            }

            const data = await response.json();
            // Extract content from the results
            const contents = data.data.map((result: any) => result.content) || [];
            return contents;

        } catch (error) {
            console.error(`Error fetching from Jina API`, error);
        }
    }

    return []; // Return empty if all attempts fail
};

export async function POST(request: NextRequest) {
    try {
        const { queries }: { queries: string[] } = await request.json();

        if (!queries || !Array.isArray(queries)) {
            return NextResponse.json({ error: "Invalid query format" }, { status: 400 });
        }

        const allResults: string[][] = [];

        // Process each query and retrieve content
        for (const query of queries) {
            const contents = await searchJinaAPI(query);
            allResults.push(contents); // Store content for each query
        }

        // Return all results
        return NextResponse.json(allResults, { status: 200 });
    } catch (error) {
        console.error("Error processing request:", error);
        return NextResponse.json({ error: "Failed to process search queries" }, { status: 500 });
    }
}
