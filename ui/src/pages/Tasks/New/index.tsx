import { FC, FormEvent, useState } from 'react';
import { Button, Form } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';

import { createTask } from '@/services';
import { loggedUserInfoStore, toastStore } from '@/stores';
import { usePageTags } from '@/hooks';

import '../index.scss';

const getErrorMessage = (err: any, fallback: string) => {
  return err?.msg || err?.message || fallback;
};

const parseList = (value: string, separator: string | RegExp) =>
  value
    .split(separator)
    .map((item) => item.trim())
    .filter(Boolean);

const NewTask: FC = () => {
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState('');
  const [rewardPoints, setRewardPoints] = useState(0);
  const [deadline, setDeadline] = useState('');
  const [submissionRequirements, setSubmissionRequirements] = useState('');
  const [attachments, setAttachments] = useState('');
  const [reviewComment, setReviewComment] = useState('');
  const [loading, setLoading] = useState(false);
  const roleID = loggedUserInfoStore((state) => state.user.role_id);
  const canPublishDirectly = roleID === 2 || roleID === 3;

  usePageTags({ title: '提出需求' });

  const handleSubmit = async (evt: FormEvent<HTMLFormElement>) => {
    evt.preventDefault();
    setLoading(true);
    try {
      const parsedDeadline = deadline
        ? Math.floor(new Date(deadline).getTime() / 1000)
        : 0;
      await createTask({
        title: title.trim(),
        description: description.trim(),
        ...(canPublishDirectly
          ? {
              tags: parseList(tags, /[,，]/),
              reward_points: Math.max(0, rewardPoints),
              deadline: Number.isFinite(parsedDeadline) ? parsedDeadline : 0,
              submission_requirements: submissionRequirements.trim(),
              attachments: parseList(attachments, '\n'),
              review_comment: reviewComment.trim(),
            }
          : {}),
      });
      toastStore.getState().show({
        msg: canPublishDirectly ? '任务已发布' : '需求已提交，等待审核',
        variant: 'success',
      });
      navigate('/tasks?mine=1');
    } catch (err: any) {
      toastStore.getState().show({
        msg: getErrorMessage(err, '提交失败，请稍后重试'),
        variant: 'danger',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="task-square-page">
      <div className="task-square-head compact">
        <div>
          <span className="task-square-kicker">New Request</span>
          <h1>提出需求</h1>
          <p>
            {canPublishDirectly
              ? '管理员和版主提交后会直接发布，可在这里补齐任务配置。'
              : '奖励积分、标签、截止时间和提交要求会由管理员或版主审核时补充。'}
          </p>
        </div>
      </div>
      <Form className="task-square-form" onSubmit={handleSubmit}>
        <Form.Group className="mb-3">
          <Form.Label>标题</Form.Label>
          <Form.Control
            value={title}
            maxLength={150}
            onChange={(evt) => setTitle(evt.target.value)}
          />
        </Form.Group>
        <Form.Group className="mb-3">
          <Form.Label>描述</Form.Label>
          <Form.Control
            as="textarea"
            className="task-square-description-control"
            rows={8}
            value={description}
            onChange={(evt) => setDescription(evt.target.value)}
          />
        </Form.Group>
        {canPublishDirectly ? (
          <>
            <div className="task-square-form-grid">
              <Form.Group className="mb-3">
                <Form.Label>奖励积分</Form.Label>
                <Form.Control
                  type="number"
                  min={0}
                  value={rewardPoints}
                  onChange={(evt) =>
                    setRewardPoints(Math.max(0, Number(evt.target.value) || 0))
                  }
                />
              </Form.Group>
              <Form.Group className="mb-3">
                <Form.Label>截止时间</Form.Label>
                <Form.Control
                  type="datetime-local"
                  value={deadline}
                  onChange={(evt) => setDeadline(evt.target.value)}
                />
              </Form.Group>
            </div>
            <Form.Group className="mb-3">
              <Form.Label>标签，英文逗号分隔</Form.Label>
              <Form.Control
                value={tags}
                placeholder="例如：设计, 文案, 紧急"
                onChange={(evt) => setTags(evt.target.value)}
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>提交要求</Form.Label>
              <Form.Control
                as="textarea"
                rows={4}
                value={submissionRequirements}
                onChange={(evt) => setSubmissionRequirements(evt.target.value)}
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>附件/链接，每行一个</Form.Label>
              <Form.Control
                as="textarea"
                rows={3}
                value={attachments}
                onChange={(evt) => setAttachments(evt.target.value)}
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>审核说明</Form.Label>
              <Form.Control
                as="textarea"
                rows={2}
                value={reviewComment}
                onChange={(evt) => setReviewComment(evt.target.value)}
              />
            </Form.Group>
          </>
        ) : null}
        <Button
          type="submit"
          disabled={loading || !title.trim() || !description.trim()}>
          {canPublishDirectly ? '直接发布' : '提交审核'}
        </Button>
      </Form>
    </div>
  );
};

export default NewTask;
