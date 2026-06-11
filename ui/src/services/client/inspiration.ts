import useSWR from 'swr';
import qs from 'qs';

import request from '@/utils/request';

export type InspirationStatus =
  | 'published'
  | 'pending_review'
  | 'rejected'
  | 'hidden'
  | 'deleted'
  | 'reported';

export interface InspirationListParams {
  page?: number;
  page_size?: number;
  q?: string;
  type?: string;
  category?: string;
  tag?: string;
  status?: InspirationStatus;
  sort?: 'latest' | 'hot' | 'popular' | 'featured' | 'recommend';
  mine?: boolean | string;
  featured?: boolean | string;
}

export interface InspirationPayload {
  title: string;
  summary?: string;
  content: string;
  type?: string;
  category?: string;
  tags?: string[];
  cover_url?: string;
  prompt?: string;
  model?: string;
  attachments?: string[];
  links?: string[];
  is_public?: boolean;
}

export interface InspirationItem {
  id: number;
  created_at: number;
  updated_at: number;
  published_at: number;
  user_id: string;
  username: string;
  user_display_name: string;
  user_avatar: string;
  reviewer_id: string;
  reviewer_name: string;
  title: string;
  summary: string;
  content: string;
  content_html: string;
  type: string;
  category: string;
  tags: string[];
  cover_url: string;
  prompt: string;
  model: string;
  attachments: string[];
  links: string[];
  is_public: boolean;
  is_featured: boolean;
  featured_weight: number;
  status: InspirationStatus;
  review_comment: string;
  report_reason: string;
  report_content: string;
  view_count: number;
  like_count: number;
  favorite_count: number;
  comment_count: number;
  share_count: number;
  hot_score: number;
  reward_granted: boolean;
  reward_revoked: boolean;
  reward_logs?: InspirationRewardLog[];
  liked: boolean;
  favorited: boolean;
  can_edit: boolean;
  can_manage: boolean;
  related?: InspirationItem[];
}

export interface InspirationRewardLog {
  id: number;
  created_at: number;
  source_type: string;
  delta: number;
  balance: number;
  description: string;
  operator_id: string;
}

export interface InspirationComment {
  id: number;
  created_at: number;
  updated_at: number;
  inspiration_id: number;
  user_id: string;
  username: string;
  display_name: string;
  avatar: string;
  content: string;
  status: string;
}

export interface InspirationSetting {
  require_review: boolean;
  publish_reward_enabled: boolean;
  publish_reward_points: number;
  reward_after_review: boolean;
  revoke_reward_on_delete: boolean;
  featured_default_weight: number;
  recommendation_hot_weight: number;
  recommendation_fresh_weight: number;
  categories: string[];
}

export interface InspirationAuthorRank {
  user_id: string;
  username: string;
  display_name: string;
  avatar: string;
  count: number;
  hot_score: number;
}

export interface InspirationTaxonomyItem {
  name: string;
  count: number;
}

export interface InspirationTaxonomy {
  categories: InspirationTaxonomyItem[];
  tags: InspirationTaxonomyItem[];
  types: InspirationTaxonomyItem[];
}

export const useInspirations = (params: InspirationListParams) =>
  useSWR<{ count: number; list: InspirationItem[] }>(
    `/answer/api/v1/inspirations?${qs.stringify(params)}`,
    request.instance.get,
  );

export const useInspiration = (id?: string | number) =>
  useSWR<InspirationItem>(
    id ? `/answer/api/v1/inspirations/${id}` : null,
    request.instance.get,
  );

export const useInspirationComments = (
  id?: string | number,
  params: { page?: number; page_size?: number } = {},
) =>
  useSWR<{ count: number; list: InspirationComment[] }>(
    id
      ? `/answer/api/v1/inspirations/${id}/comments?${qs.stringify(params)}`
      : null,
    request.instance.get,
  );

export const createInspiration = (params: InspirationPayload) =>
  request.post<InspirationItem>('/answer/api/v1/inspirations', params);

export const updateInspiration = (id: number, params: InspirationPayload) =>
  request.put<InspirationItem>(`/answer/api/v1/inspirations/${id}`, params);

export const deleteInspiration = (id: number) =>
  request.delete(`/answer/api/v1/inspirations/${id}`);

export const likeInspiration = (id: number) =>
  request.post(`/answer/api/v1/inspirations/${id}/like`);

export const unlikeInspiration = (id: number) =>
  request.delete(`/answer/api/v1/inspirations/${id}/like`);

export const favoriteInspiration = (id: number) =>
  request.post(`/answer/api/v1/inspirations/${id}/favorite`);

export const unfavoriteInspiration = (id: number) =>
  request.delete(`/answer/api/v1/inspirations/${id}/favorite`);

export const shareInspiration = (id: number) =>
  request.post(`/answer/api/v1/inspirations/${id}/share`);

export const addInspirationComment = (id: number, content: string) =>
  request.post<InspirationComment>(
    `/answer/api/v1/inspirations/${id}/comments`,
    {
      content,
    },
  );

export const reportInspiration = (
  id: number,
  params: { reason: string; content?: string },
) => request.post(`/answer/api/v1/inspirations/${id}/report`, params);

export const useInspirationAuthorRanking = () =>
  useSWR<InspirationAuthorRank[]>(
    '/answer/api/v1/inspirations/ranking/authors',
    request.instance.get,
  );

export const useInspirationTaxonomy = () =>
  useSWR<InspirationTaxonomy>(
    '/answer/api/v1/inspirations/taxonomy',
    request.instance.get,
  );

export const useAdminInspirations = (params: InspirationListParams) =>
  useSWR<{ count: number; list: InspirationItem[] }>(
    `/answer/admin/api/inspirations?${qs.stringify(params)}`,
    request.instance.get,
  );

export const getReviewInspirations = (params: InspirationListParams) =>
  request.get<{ count: number; list: InspirationItem[] }>(
    `/answer/api/v1/review/inspirations?${qs.stringify(params)}`,
  );

export const reviewInspiration = (params: {
  id: number;
  status?: InspirationStatus;
  review_comment?: string;
  featured?: boolean;
  featured_weight?: number;
  revoke_reward?: boolean;
  ban_author?: boolean;
}) => request.put<InspirationItem>('/answer/api/v1/review/inspiration', params);

export const adminUpdateInspiration = (
  id: number,
  params: {
    status?: InspirationStatus;
    review_comment?: string;
    featured?: boolean;
    featured_weight?: number;
    revoke_reward?: boolean;
    ban_author?: boolean;
  },
) =>
  request.put<InspirationItem>(
    `/answer/admin/api/inspirations/${id}/action`,
    params,
  );

export const adminHideInspiration = (id: number) =>
  request.post<InspirationItem>(`/answer/admin/api/inspirations/${id}/hide`);

export const adminRestoreInspiration = (id: number) =>
  request.post<InspirationItem>(`/answer/admin/api/inspirations/${id}/restore`);

export const adminDeleteInspiration = (id: number) =>
  request.delete<InspirationItem>(`/answer/admin/api/inspirations/${id}`);

export const adminBanInspirationAuthor = (id: number) =>
  request.post<InspirationItem>(
    `/answer/admin/api/inspirations/${id}/ban-author`,
  );

export const useInspirationSetting = () =>
  useSWR<InspirationSetting>(
    '/answer/admin/api/inspiration-settings',
    request.instance.get,
  );

export const saveInspirationSetting = (params: InspirationSetting) =>
  request.put<InspirationSetting>(
    '/answer/admin/api/inspiration-settings',
    params,
  );
