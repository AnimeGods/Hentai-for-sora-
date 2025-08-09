const BASE_URL = 'https://hanime.tv';
const SEARCH_URL = 'https://hanime.tv/api/v8/search?keyword=';

/**
 * Search Hanime.tv API for keyword matches and return results
 * @param {string} keyword 
 * @returns {Promise<string>} JSON string of search results [{title, image, href}, ...]
 */
async function searchResults(keyword) {
    try {
        const response = await fetch(`${SEARCH_URL}${encodeURIComponent(keyword)}`);
        if (!response.ok) throw new Error('Network response not ok');
        const data = await response.json();

        if (!data || !data.results) {
            return JSON.stringify([]);
        }

        // Map Hanime API search results to expected format
        const results = data.results.map(item => ({
            title: item.title,
            image: item.cover,
            href: `${BASE_URL}/videos/${item.id}`
        }));

        return JSON.stringify(results);
    } catch (error) {
        console.log('Search error:', error.message);
        return JSON.stringify([]);
    }
}

/**
 * Extract anime details: description, aliases (other titles), airdate (upload date)
 * @param {string} url 
 * @returns {Promise<string>} JSON string [{description, aliases, airdate}]
 */
async function extractDetails(url) {
    try {
        // Extract video ID from URL: https://hanime.tv/videos/12345
        const idMatch = url.match(/\/videos\/(\d+)/);
        if (!idMatch) throw new Error('Invalid video URL');
        const videoId = idMatch[1];

        // API endpoint for details (using Hanime API v8)
        const detailsUrl = `https://hanime.tv/api/v8/videos/${videoId}`;

        const response = await fetch(detailsUrl);
        if (!response.ok) throw new Error('Network response not ok');
        const data = await response.json();

        if (!data || !data.video) {
            throw new Error('No video data found');
        }

        const video = data.video;

        // description = video.description
        // aliases = join title + original_title + alt_titles
        // airdate = formatted upload date

        const aliases = [video.title, video.original_title, ...(video.alt_titles || [])]
            .filter(Boolean)
            .join(', ');

        // Format date (upload_date is ISO string)
        const airdate = video.upload_date ? new Date(video.upload_date).toLocaleDateString() : 'Unknown';

        const details = {
            description: video.description || 'No description available',
            aliases: aliases,
            airdate: airdate
        };

        return JSON.stringify([details]);
    } catch (error) {
        console.log('Details error:', error.message);
        return JSON.stringify([{
            description: 'Error loading description',
            aliases: 'Duration: Unknown',
            airdate: 'Aired: Unknown'
        }]);
    }
}

/**
 * Extract episodes list from given url (Hanime videos are usually single-episode, but we return a single episode object)
 * @param {string} url 
 * @returns {Promise<string>} JSON string of episodes [{href, number}]
 */
async function extractEpisodes(url) {
    try {
        // Hanime.tv videos are single items, so return single episode object
        const idMatch = url.match(/\/videos\/(\d+)/);
        if (!idMatch) throw new Error('Invalid video URL');
        const videoId = idMatch[1];

        return JSON.stringify([{
            href: url,
            number: 1
        }]);
    } catch (error) {
        console.log('Episodes error:', error.message);
        return JSON.stringify([]);
    }
}

/**
 * Extract the direct stream URL (HLS or MP4) from the video page using Hanime API
 * @param {string} url 
 * @returns {Promise<string|null>} JSON string with stream URL or null if error
 */
async function extractStreamUrl(url) {
    try {
        const idMatch = url.match(/\/videos\/(\d+)/);
        if (!idMatch) throw new Error('Invalid video URL');
        const videoId = idMatch[1];

        // Hanime API to get streaming sources
        const sourcesUrl = `https://hanime.tv/api/v8/videos/${videoId}/sources`;

        const response = await fetch(sourcesUrl);
        if (!response.ok) throw new Error('Network response not ok');
        const data = await response.json();

        if (!data || !data.sources || data.sources.length === 0) {
            throw new Error('No streaming sources found');
        }

        // Prefer HLS sources (m3u8), fallback to mp4
        let streamSource = data.sources.find(src => src.url && src.url.endsWith('.m3u8'));
        if (!streamSource) {
            streamSource = data.sources.find(src => src.url && src.url.endsWith('.mp4'));
        }

        if (!streamSource) throw new Error('No valid stream URL found');

        // Also try to get subtitles (English)
        const subtitles = (data.subtitles || []).filter(sub => sub.lang === 'en').map(sub => ({
            url: sub.url,
            lang: sub.lang,
            name: sub.name || 'English'
        }));

        // Return JSON string with stream url and subtitles array
        return JSON.stringify({
            stream: streamSource.url,
            subtitles: subtitles.length > 0 ? subtitles : null
        });

    } catch (error) {
        console.log('Stream URL error:', error.message);
        return JSON.stringify({ stream: null, subtitles: null });
    }
}

// Optional helper functions like soraFetch can be added if needed, otherwise fetch is used
