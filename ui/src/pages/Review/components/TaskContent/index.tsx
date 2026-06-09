/*
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

import { FC, useEffect, useState } from 'react';
import { Alert, Button, Card, Form, Stack } from 'react-bootstrap';

import { FormatTime } from '@/components';
import {
  getReviewTasks,
  reviewTaskInCenter,
  reviewTaskSubmissionInCenter,
  TaskItem,
  TaskStatus,
} from '@/services';
import { toastStore } from '@/stores';
import { scrollToDocTop } from '@/utils';

const PAGE_SIZE = 1;

type ReviewMode = Extract<
  TaskStatus,
  'pending_review' | 'in_progress' | 'submitted'
>;
type TaskPublishStatus = 'open' | 'rejected' | 'closed' | 'failed';

interface IProps {
  refreshCount: () => void;
  status: ReviewMode;
}

const modeTitle: Record<ReviewMode, string> = {
  pending_review: '待审核需求',
  in_progress: '进行中需求',
  submitted: '待验收任务',
};

const statusOptions: Array<{ label: string; value: TaskPublishStatus }> = [
  { label: '发布', value: 'open' },
  { label: '驳回', value: 'rejected' },
  { label: '关闭', value: 'closed' },
  { label: '标记失败', value: 'failed' },
];

const getErrorMessage = (err: any, fallback: string) =>
  err?.msg || err?.message || fallback;

const toDateTimeLocal = (timestamp: number) =>
  timestamp ? new Date(timestamp * 1000).toISOString().slice(0, 16) : '';

const fromDateTimeLocal = (value?: string) =>
  value ? Math.floor(new Date(value).getTime() / 1000) : 0;

const taskToForm = (task: TaskItem | null) => ({
  title: task?.title || '',
  description: task?.description || '',
  tags: task?.tags?.join(',') || '',
  reward_points: task?.reward_points || 0,
  deadline: toDateTimeLocal(task?.deadline || 0),
  submission_requirements: task?.submission_requirements || '',
  attachments: task?.attachments?.join('\n') || '',
  status: 'open' as TaskPublishStatus,
  review_comment: task?.review_comment || '',
});

const TaskContent: FC<IProps> = ({ refreshCount, status }) => {
  const [page, setPage] = useState(1);
  const [taskResp, setTaskResp] = useState<{
    count: number;
    list: TaskItem[];
  }>();
  const [form, setForm] = useState<Record<string, any>>({});
  const [reviewNote, setReviewNote] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const task = taskResp?.list?.[0] || null;

  const queryNextOne = async (pageNumber: number) => {
    try {
      const resp = await getReviewTasks({
        page: pageNumber,
        page_size: PAGE_SIZE,
        status,
      });
      const { count, list = [] } = resp;
      if (!list.length && count && pageNumber !== 1) {
        setPage(1);
        queryNextOne(1);
        return;
      }
      setPage(pageNumber);
      setTaskResp(resp);
      setForm(taskToForm(list[0] || null));
      setReviewNote('');
      setTimeout(() => {
        scrollToDocTop();
      }, 150);
    } catch (err) {
      console.error('query review task error:', err);
      setTaskResp({ count: 0, list: [] });
    }
  };

  useEffect(() => {
    queryNextOne(1);
  }, [status]);

  useEffect(() => {
    const handleRealtime = (evt: Event) => {
      const event = (evt as CustomEvent).detail;
      if (event?.type !== 'tasks.changed') {
        return;
      }
      const taskID = Number(event?.data?.task_id || 0);
      const nextStatus = event?.data?.status;
      if (!taskID || taskID !== task?.id) {
        return;
      }
      if (!nextStatus || nextStatus !== status) {
        queryNextOne(page);
        refreshCount();
      }
    };

    window.addEventListener('hcai:realtime', handleRealtime);
    return () => {
      window.removeEventListener('hcai:realtime', handleRealtime);
    };
  }, [page, refreshCount, status, task?.id]);

  const handleSkip = () => {
    queryNextOne(page + 1);
  };

  const handleTaskReview = async () => {
    if (!task) {
      return;
    }
    setIsLoading(true);
    try {
      await reviewTaskInCenter({
        id: task.id,
        title: form.title,
        description: form.description,
        tags: String(form.tags || '')
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean),
        reward_points: Number(form.reward_points) || 0,
        deadline: fromDateTimeLocal(form.deadline),
        submission_requirements: form.submission_requirements || '',
        attachments: String(form.attachments || '')
          .split('\n')
          .map((item) => item.trim())
          .filter(Boolean),
        status: form.status || 'open',
        review_comment: form.review_comment || '',
      });
      toastStore.getState().show({ msg: '审核已保存', variant: 'success' });
      refreshCount();
      queryNextOne(page);
    } catch (err: any) {
      toastStore.getState().show({
        msg: getErrorMessage(err, '审核失败，请稍后重试'),
        variant: 'danger',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmissionReview = async (approved: boolean) => {
    if (!task) {
      return;
    }
    setIsLoading(true);
    try {
      await reviewTaskSubmissionInCenter({
        submission_id: task.submission?.id,
        task_id: task.id,
        approved,
        review_note: reviewNote,
      });
      toastStore.getState().show({
        msg: approved ? '验收通过，积分已发放' : '已退回修改',
        variant: 'success',
      });
      refreshCount();
      queryNextOne(page);
    } catch (err: any) {
      toastStore.getState().show({
        msg: getErrorMessage(err, '验收失败，请稍后重试'),
        variant: 'danger',
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (!task) {
    return null;
  }

  return (
    <Card>
      <Card.Header>{modeTitle[status]}</Card.Header>
      <Card.Body className="p-0">
        <Alert variant="info" className="border-0 rounded-0 mb-0">
          <Stack gap={1}>
            <strong>{task.title}</strong>
            <span className="small text-secondary">
              提交人：{task.user_display_name || task.user_id}
              {task.created_at ? (
                <>
                  <span className="mx-2">·</span>
                  <FormatTime time={task.created_at} />
                </>
              ) : null}
            </span>
          </Stack>
        </Alert>

        {status === 'pending_review' ? (
          <div className="p-3">
            <Form.Group className="mb-2">
              <Form.Label>标题</Form.Label>
              <Form.Control
                value={form.title || ''}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
            </Form.Group>
            <Form.Group className="mb-2">
              <Form.Label>描述</Form.Label>
              <Form.Control
                as="textarea"
                rows={4}
                value={form.description || ''}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
              />
            </Form.Group>
            <div className="row">
              <Form.Group className="mb-2 col-md-6">
                <Form.Label>标签，英文逗号分隔</Form.Label>
                <Form.Control
                  value={form.tags || ''}
                  onChange={(e) => setForm({ ...form, tags: e.target.value })}
                />
              </Form.Group>
              <Form.Group className="mb-2 col-md-3">
                <Form.Label>奖励积分</Form.Label>
                <Form.Control
                  type="number"
                  value={form.reward_points || 0}
                  onChange={(e) =>
                    setForm({ ...form, reward_points: e.target.value })
                  }
                />
              </Form.Group>
              <Form.Group className="mb-2 col-md-3">
                <Form.Label>截止时间</Form.Label>
                <Form.Control
                  type="datetime-local"
                  value={form.deadline || ''}
                  onChange={(e) =>
                    setForm({ ...form, deadline: e.target.value })
                  }
                />
              </Form.Group>
            </div>
            <Form.Group className="mb-2">
              <Form.Label>提交要求</Form.Label>
              <Form.Control
                as="textarea"
                rows={3}
                value={form.submission_requirements || ''}
                onChange={(e) =>
                  setForm({
                    ...form,
                    submission_requirements: e.target.value,
                  })
                }
              />
            </Form.Group>
            <Form.Group className="mb-2">
              <Form.Label>附件/链接，每行一个</Form.Label>
              <Form.Control
                as="textarea"
                rows={2}
                value={form.attachments || ''}
                onChange={(e) =>
                  setForm({ ...form, attachments: e.target.value })
                }
              />
            </Form.Group>
            <div className="row">
              <Form.Group className="mb-2 col-md-4">
                <Form.Label>审核结果</Form.Label>
                <Form.Select
                  value={form.status || 'open'}
                  onChange={(e) =>
                    setForm({ ...form, status: e.target.value })
                  }>
                  {statusOptions.map((option) => (
                    <option value={option.value} key={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Form.Select>
              </Form.Group>
              <Form.Group className="mb-2 col-md-8">
                <Form.Label>审核说明</Form.Label>
                <Form.Control
                  value={form.review_comment || ''}
                  onChange={(e) =>
                    setForm({ ...form, review_comment: e.target.value })
                  }
                />
              </Form.Group>
            </div>
            <div className="d-flex justify-content-end gap-2 mt-3">
              <Button
                variant="outline-primary"
                disabled={isLoading}
                onClick={handleSkip}>
                跳过
              </Button>
              <Button disabled={isLoading} onClick={handleTaskReview}>
                保存审核
              </Button>
            </div>
          </div>
        ) : status === 'in_progress' ? (
          <div className="p-3">
            <div className="row g-3">
              <div className="col-md-8">
                <div className="text-secondary small mb-1">需求说明</div>
                <p className="mb-0 text-break">{task.description || '暂无'}</p>
              </div>
              <div className="col-md-4">
                <div className="text-secondary small mb-1">领取人</div>
                <p className="mb-0">
                  {task.assignee_display_name || task.assignee_id || '暂无'}
                </p>
              </div>
              <div className="col-md-4">
                <div className="text-secondary small mb-1">奖励积分</div>
                <p className="mb-0">{task.reward_points || 0}</p>
              </div>
              <div className="col-md-4">
                <div className="text-secondary small mb-1">领取时间</div>
                <p className="mb-0">
                  {task.claimed_at ? (
                    <FormatTime time={task.claimed_at} />
                  ) : (
                    '暂无'
                  )}
                </p>
              </div>
              <div className="col-md-4">
                <div className="text-secondary small mb-1">截止时间</div>
                <p className="mb-0">
                  {task.deadline ? <FormatTime time={task.deadline} /> : '暂无'}
                </p>
              </div>
              <div className="col-md-6">
                <div className="text-secondary small mb-1">提交要求</div>
                <p className="mb-0 text-break">
                  {task.submission_requirements || '暂无'}
                </p>
              </div>
              <div className="col-md-6">
                <div className="text-secondary small mb-1">附件/链接</div>
                {task.attachments?.length ? (
                  task.attachments.map((link) => (
                    <a
                      className="d-block text-break"
                      href={link}
                      key={link}
                      target="_blank"
                      rel="noreferrer">
                      {link}
                    </a>
                  ))
                ) : (
                  <p className="mb-0">暂无</p>
                )}
              </div>
            </div>
            <div className="d-flex justify-content-end gap-2 mt-3">
              <Button
                variant="outline-primary"
                disabled={isLoading}
                onClick={handleSkip}>
                跳过
              </Button>
            </div>
          </div>
        ) : (
          <div className="p-3">
            <div className="mb-3">
              <div className="text-secondary small mb-1">任务说明</div>
              <p className="mb-0 text-break">{task.description || '暂无'}</p>
            </div>
            <div className="mb-3">
              <div className="text-secondary small mb-1">提交成果</div>
              <p className="mb-0 text-break">
                {task.submission?.content || '暂无提交内容'}
              </p>
            </div>
            {task.submission?.links?.length ? (
              <div className="mb-3">
                <div className="text-secondary small mb-1">成果链接</div>
                {task.submission.links.map((link) => (
                  <a
                    className="d-block text-break"
                    href={link}
                    key={link}
                    target="_blank"
                    rel="noreferrer">
                    {link}
                  </a>
                ))}
              </div>
            ) : null}
            <Form.Group>
              <Form.Label>验收说明</Form.Label>
              <Form.Control
                as="textarea"
                rows={3}
                value={reviewNote}
                onChange={(e) => setReviewNote(e.target.value)}
              />
            </Form.Group>
            <div className="d-flex justify-content-end gap-2 mt-3">
              <Button
                variant="outline-primary"
                disabled={isLoading}
                onClick={handleSkip}>
                跳过
              </Button>
              <Button
                variant="outline-danger"
                disabled={isLoading}
                onClick={() => handleSubmissionReview(false)}>
                不通过
              </Button>
              <Button
                disabled={isLoading}
                onClick={() => handleSubmissionReview(true)}>
                通过并发积分
              </Button>
            </div>
          </div>
        )}
      </Card.Body>
    </Card>
  );
};

export default TaskContent;
