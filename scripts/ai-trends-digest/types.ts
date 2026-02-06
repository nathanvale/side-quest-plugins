/**
 * Types for AI Trends Digest
 */

/** Research result from @side-quest/last-30-days --emit=json */
export interface ResearchResult {
	topic: string
	mode: 'both' | 'reddit-only' | 'x-only' | 'web-only'
	reddit?: RedditData
	x?: XData
	web?: WebData
}

export interface RedditData {
	threads: RedditThread[]
	stats: {
		totalThreads: number
		totalUpvotes: number
		totalComments: number
	}
}

export interface RedditThread {
	title: string
	subreddit: string
	upvotes: number
	comments: number
	url: string
	snippet?: string
}

export interface XData {
	posts: XPost[]
	stats: {
		totalPosts: number
		totalLikes: number
		totalReposts: number
	}
}

export interface XPost {
	author: string
	handle: string
	content: string
	likes: number
	reposts: number
	url: string
}

export interface WebData {
	pages: WebPage[]
	stats: {
		totalPages: number
		domains: string[]
	}
}

export interface WebPage {
	title: string
	url: string
	domain: string
	snippet?: string
}

/** Configuration for the digest */
export interface DigestConfig {
	recipient: string
	dryRun: boolean
	topics: string[]
}
