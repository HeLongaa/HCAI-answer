import useSWR from 'swr';
import qs from 'qs';

import request from '@/utils/request';

export interface TaskItem {
  id: number;
  created_at: number;
  updated_at: number;
  user_id: string;
  user_display_name: string;
  reviewer_id: string;
  assignee_id: string;
  assignee_display_name: string;
  title: string;
  description: string;
  tags: string[];
  reward_points: number;
  deadline: number;
  submission_requirements: string;
  attachments: string[];
  status: string;
  review_comment: string;
  claimed_at: number;
  completed_at: number;
  submission?: TaskSubmission;
}

export interface TaskSubmission {
  id: number;
  created_at: number;
  updated_at: number;
  task_id: number;
  user_id: string;
  reviewer_id: string;
  content: string;
  links: string[];
  attachments: string[];
  status: string;
  review_note: string;
}

export interface PointTransaction {
  id: number;
  created_at: number;
  source_type: string;
  source_id: string;
  delta: number;
  balance: number;
  description: string;
  operator_id: string;
}

export interface FeaturedPost {
  id: number;
  created_at: number;
  question_id: string;
  author_id: string;
  author_name: string;
  operator_id: string;
  title: string;
  reward_points: number;
  note: string;
  active: boolean;
  revoked: boolean;
  revoked_at: number;
}

export const useTasks = (params: Record<string, any>) =>
  useSWR<{ count: number; list: TaskItem[] }>(
    `/answer/api/v1/tasks?${qs.stringify(params)}`,
    request.instance.get,
  );

export const getTask = (id: number) =>
  request.get<TaskItem>(`/answer/api/v1/task?id=${id}`);

export const createTask = (params: {
  title: string;
  description: string;
  attachments?: string[];
}) => request.post('/answer/api/v1/task', params);

export const claimTask = (id: number) =>
  request.post('/answer/api/v1/task/claim', { id });

export const submitTask = (params: {
  id: number;
  content: string;
  links?: string[];
  attachments?: string[];
}) => request.post('/answer/api/v1/task/submission', params);

export const usePointAccount = () =>
  useSWR<{ balance: number }>(
    '/answer/api/v1/points/account',
    request.instance.get,
  );

export const usePointTransactions = (params: Record<string, any>) =>
  useSWR<{ count: number; list: PointTransaction[] }>(
    `/answer/api/v1/points/transactions?${qs.stringify(params)}`,
    request.instance.get,
  );

export const useAdminTasks = (params: Record<string, any>) =>
  useSWR<{ count: number; list: TaskItem[] }>(
    `/answer/admin/api/tasks?${qs.stringify(params)}`,
    request.instance.get,
  );

export const reviewTask = (params: Record<string, any>) =>
  request.put('/answer/admin/api/task/review', params);

export const assignTask = (params: { id: number; assignee_id: string }) =>
  request.put('/answer/admin/api/task/assign', params);

export const reviewTaskSubmission = (params: {
  submission_id?: number;
  task_id?: number;
  approved: boolean;
  review_note?: string;
}) => request.put('/answer/admin/api/task/submission/review', params);

export const useFeaturedPosts = (params: Record<string, any>) =>
  useSWR<{ count: number; list: FeaturedPost[] }>(
    `/answer/admin/api/featured-posts?${qs.stringify(params)}`,
    request.instance.get,
  );

export const featurePost = (params: {
  question_id: string;
  reward_points: number;
  note?: string;
}) => request.post('/answer/admin/api/featured-post', params);

export const revokeFeaturedPost = (params: { question_id: string }) =>
  request.put('/answer/admin/api/featured-post/revoke', params);
