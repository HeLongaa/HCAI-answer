import {
  ChangeEvent,
  FC,
  FormEvent,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { Button, Form } from 'react-bootstrap';
import { useNavigate, useParams } from 'react-router-dom';

import {
  createInspiration,
  InspirationPayload,
  updateInspiration,
  uploadImage,
  useInspiration,
  useInspirationTaxonomy,
} from '@/services';
import { toastStore } from '@/stores';
import { usePageTags } from '@/hooks';
import InspirationBackButton from '../BackButton';

import '../index.scss';

const parseList = (value: string, separator: string | RegExp) =>
  value
    .split(separator)
    .map((item) => item.trim())
    .filter(Boolean);

const getErrorMessage = (err: any, fallback: string) =>
  err?.msg || err?.message || fallback;

const NewInspiration: FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: existing } = useInspiration(id);
  const { data: taxonomy } = useInspirationTaxonomy();
  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [content, setContent] = useState('');
  const [type, setType] = useState('prompt');
  const [category, setCategory] = useState('');
  const [tags, setTags] = useState('');
  const [coverURL, setCoverURL] = useState('');
  const [prompt, setPrompt] = useState('');
  const [model, setModel] = useState('');
  const [links, setLinks] = useState('');
  const [attachments, setAttachments] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [loading, setLoading] = useState(false);
  const [coverUploading, setCoverUploading] = useState(false);
  const isEdit = Boolean(id);
  const categoryOptions = useMemo(() => {
    const items = (taxonomy?.categories || []).map((item) => item.name);
    if (category && !items.includes(category)) {
      return [category, ...items];
    }
    return items;
  }, [category, taxonomy?.categories]);

  usePageTags({ title: isEdit ? '编辑灵感' : '发布灵感' });

  useEffect(() => {
    if (!existing) {
      return;
    }
    setTitle(existing.title || '');
    setSummary(existing.summary || '');
    setContent(existing.content || '');
    setType(existing.type || 'prompt');
    setCategory(existing.category || '');
    setTags(existing.tags.join(','));
    setCoverURL(existing.cover_url || '');
    setPrompt(existing.prompt || '');
    setModel(existing.model || '');
    setLinks(existing.links.join('\n'));
    setAttachments(existing.attachments.join('\n'));
    setIsPublic(existing.is_public);
  }, [existing]);

  useEffect(() => {
    if (!category && categoryOptions.length) {
      setCategory(categoryOptions[0]);
    }
  }, [category, categoryOptions]);

  const goBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
      return;
    }
    navigate('/inspirations');
  };

  const uploadCover = async (evt: ChangeEvent<HTMLInputElement>) => {
    const file = evt.target.files?.[0];
    evt.target.value = '';
    if (!file || coverUploading) {
      return;
    }
    setCoverUploading(true);
    try {
      const url = await uploadImage({ file, type: 'post' });
      setCoverURL(String(url));
      toastStore.getState().show({ msg: '封面图已上传', variant: 'success' });
    } catch (err: any) {
      toastStore.getState().show({
        msg: getErrorMessage(err, '封面上传失败'),
        variant: 'danger',
      });
    } finally {
      setCoverUploading(false);
    }
  };

  const handleSubmit = async (evt: FormEvent<HTMLFormElement>) => {
    evt.preventDefault();
    setLoading(true);
    try {
      const payload: InspirationPayload = {
        title: title.trim(),
        summary: summary.trim(),
        content: content.trim(),
        type,
        category: category.trim(),
        tags: parseList(tags, /[,，]/),
        cover_url: coverURL.trim(),
        prompt: prompt.trim(),
        model: model.trim(),
        links: parseList(links, '\n'),
        attachments: parseList(attachments, '\n'),
        is_public: isPublic,
      };
      const resp =
        isEdit && existing
          ? await updateInspiration(existing.id, payload)
          : await createInspiration(payload);
      toastStore.getState().show({
        msg: isEdit ? '灵感已更新' : '灵感已发布',
        variant: 'success',
      });
      navigate(`/inspirations/${resp.id}`);
    } catch (err: any) {
      toastStore.getState().show({
        msg: getErrorMessage(err, '发布失败，请稍后重试'),
        variant: 'danger',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="inspiration-page">
      <header className="inspiration-head inspiration-form-head">
        <InspirationBackButton inline onClick={goBack} />
        <div>
          <span className="inspiration-kicker">
            {isEdit ? 'Edit Inspiration' : 'New Inspiration'}
          </span>
          <h1>{isEdit ? '编辑灵感' : '发布灵感'}</h1>
          <p>
            {isEdit
              ? '调整已发布的提示词、Skill、创作方案或案例。'
              : '分享提示词、Skill、创作方案或案例，默认发布后直接展示并获得积分奖励。'}
          </p>
        </div>
      </header>
      <Form className="inspiration-form" onSubmit={handleSubmit}>
        <Form.Group className="mb-3">
          <Form.Label>标题</Form.Label>
          <Form.Control
            value={title}
            maxLength={180}
            onChange={(evt) => setTitle(evt.target.value)}
          />
        </Form.Group>
        <Form.Group className="mb-3">
          <Form.Label>摘要</Form.Label>
          <Form.Control
            as="textarea"
            rows={2}
            value={summary}
            onChange={(evt) => setSummary(evt.target.value)}
          />
        </Form.Group>
        <Form.Group className="mb-3">
          <Form.Label>正文</Form.Label>
          <Form.Control
            as="textarea"
            rows={8}
            value={content}
            onChange={(evt) => setContent(evt.target.value)}
          />
        </Form.Group>
        <div className="inspiration-form-grid">
          <Form.Group className="mb-3">
            <Form.Label>类型</Form.Label>
            <Form.Select
              value={type}
              onChange={(evt) => setType(evt.target.value)}>
              <option value="prompt">提示词</option>
              <option value="skill">Skill</option>
              <option value="workflow">创作方案</option>
              <option value="case">案例</option>
            </Form.Select>
          </Form.Group>
          <Form.Group className="mb-3">
            <Form.Label>分类</Form.Label>
            <Form.Select
              value={category}
              disabled={!categoryOptions.length}
              onChange={(evt) => setCategory(evt.target.value)}
              required>
              {categoryOptions.length ? (
                categoryOptions.map((item) => (
                  <option value={item} key={item}>
                    {item}
                  </option>
                ))
              ) : (
                <option value="">暂无可选分类，请联系管理员配置</option>
              )}
            </Form.Select>
          </Form.Group>
        </div>
        <Form.Group className="mb-3">
          <Form.Label>标签，逗号分隔</Form.Label>
          <Form.Control
            value={tags}
            onChange={(evt) => setTags(evt.target.value)}
          />
        </Form.Group>
        <Form.Group className="mb-3">
          <Form.Label>封面图</Form.Label>
          <div className="inspiration-cover-field">
            <Form.Control
              value={coverURL}
              placeholder="填写图片 URL，或上传本地图片"
              onChange={(evt) => setCoverURL(evt.target.value)}
            />
            <label className="btn btn-outline-primary mb-0">
              {coverUploading ? '上传中...' : '上传图片'}
              <input
                type="file"
                className="d-none"
                accept="image/jpeg,image/jpg,image/png,image/webp"
                disabled={coverUploading}
                onChange={uploadCover}
              />
            </label>
          </div>
          {coverURL ? (
            <img className="inspiration-cover-preview" src={coverURL} alt="" />
          ) : null}
        </Form.Group>
        <div className="inspiration-form-grid">
          <Form.Group className="mb-3">
            <Form.Label>适用模型</Form.Label>
            <Form.Control
              value={model}
              onChange={(evt) => setModel(evt.target.value)}
            />
          </Form.Group>
          <Form.Group className="mb-3">
            <Form.Label>公开展示</Form.Label>
            <Form.Check
              type="switch"
              checked={isPublic}
              label={isPublic ? '公开' : '仅自己可见'}
              onChange={(evt) => setIsPublic(evt.target.checked)}
            />
          </Form.Group>
        </div>
        <Form.Group className="mb-3">
          <Form.Label>提示词内容</Form.Label>
          <Form.Control
            as="textarea"
            rows={5}
            value={prompt}
            onChange={(evt) => setPrompt(evt.target.value)}
          />
        </Form.Group>
        <Form.Group className="mb-3">
          <Form.Label>附件，每行一个</Form.Label>
          <Form.Control
            as="textarea"
            rows={2}
            value={attachments}
            onChange={(evt) => setAttachments(evt.target.value)}
          />
        </Form.Group>
        <Form.Group className="mb-3">
          <Form.Label>链接，每行一个</Form.Label>
          <Form.Control
            as="textarea"
            rows={2}
            value={links}
            onChange={(evt) => setLinks(evt.target.value)}
          />
        </Form.Group>
        <Button
          type="submit"
          disabled={loading || !title.trim() || !content.trim()}>
          {isEdit ? '保存修改' : '发布'}
        </Button>
      </Form>
    </main>
  );
};

export default NewInspiration;
