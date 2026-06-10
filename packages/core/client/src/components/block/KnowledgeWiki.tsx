import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Layout, Input, List, Button, Card, Typography, Space, Tag, Spin, Empty, Divider, Tooltip, Alert, message, Modal } from 'antd';
import { FileTextOutlined, LinkOutlined, EditOutlined, EyeOutlined, PlusOutlined, SearchOutlined, ShareAltOutlined, ExpandOutlined } from '@ant-design/icons';
import { useAPIClient } from '../../providers/APIClientProvider';

const { Sider, Content } = Layout;
const { Title, Paragraph, Text } = Typography;

export interface WikiNode {
  id: number;
  uid: string;
  title: string;
  type: 'entity' | 'activity' | 'note' | string;
  content: string;
  meta?: any;
  links?: string[];
  backlinks?: string[];
  createdAt?: string;
  updatedAt?: string;
}

export interface KnowledgeWikiProps {
  collection?: string; // Automatically populated as 'app_<appName>_memory_nodes'
  style?: React.CSSProperties;
}

interface GraphNode {
  id: string;
  label: string;
  type: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  isCurrent: boolean;
}

interface GraphLink {
  source: string;
  target: string;
}

export const KnowledgeWiki: React.FC<KnowledgeWikiProps> = ({
  collection,
  style,
}) => {
  const apiClient = useAPIClient();
  const [nodes, setNodes] = useState<WikiNode[]>([]);
  const [activeNode, setActiveNode] = useState<WikiNode | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editedContent, setEditedContent] = useState('');
  const [backlinks, setBacklinks] = useState<WikiNode[]>([]);
  const [graphOpen, setGraphOpen] = useState(true);

  // Force-directed graph states
  const [graphNodes, setGraphNodes] = useState<GraphNode[]>([]);
  const [graphLinks, setGraphLinks] = useState<GraphLink[]>([]);
  const animationFrameRef = useRef<number | null>(null);

  // Zoom & Pan states
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });

  // Dragging node states
  const [draggedNodeId, setDraggedNodeId] = useState<string | null>(null);
  const dragRef = useRef<{ id: string | null; x: number; y: number }>({ id: null, x: 0, y: 0 });

  // Modal Graph states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalZoom, setModalZoom] = useState(1.5);
  const [modalPan, setModalPan] = useState({ x: 250, y: 50 });
  const [isModalPanning, setIsModalPanning] = useState(false);
  const [modalPanStart, setModalPanStart] = useState({ x: 0, y: 0 });

  // Fetch all wiki nodes
  const fetchNodes = useCallback(async (selectTitle?: string) => {
    if (!collection || !apiClient) return;
    setLoading(true);
    try {
      const res = await apiClient.request({
        url: `/api/${collection}`,
        method: 'GET',
        params: { pageSize: 200, sort: ['-updatedAt'] },
      });
      const data: WikiNode[] = res?.data || [];
      setNodes(data);

      if (data.length > 0) {
        // If a specific note is requested, set it active; otherwise default to first
        let defaultActive = data[0];
        if (selectTitle) {
          const matched = data.find((n) => n.title.toLowerCase() === selectTitle.toLowerCase());
          if (matched) defaultActive = matched;
        }
        setActiveNode(defaultActive);
        setEditedContent(defaultActive.content || '');
        setEditMode(false);
      } else {
        setActiveNode(null);
      }
    } catch (err) {
      console.error('[KnowledgeWiki] Failed to load wiki nodes:', err);
    } finally {
      setLoading(false);
    }
  }, [collection, apiClient]);

  // Load initial nodes
  useEffect(() => {
    fetchNodes();
  }, [fetchNodes]);

  // Handle active node changes to query backlinks & generate Graph
  useEffect(() => {
    // Reset zoom and pan on active node change
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setModalZoom(1.5);
    setModalPan({ x: 250, y: 50 });
    setIsModalOpen(false);
    dragRef.current = { id: null, x: 0, y: 0 };
    setDraggedNodeId(null);

    if (!activeNode) {
      setBacklinks([]);
      setGraphNodes([]);
      setGraphLinks([]);
      return;
    }

    // Backlinks: Any page that links to this activeNode's title
    const activeTitle = activeNode.title;
    const linksToActive = nodes.filter(
      (n) =>
        n.id !== activeNode.id &&
        (n.links?.some((l) => l.toLowerCase() === activeTitle.toLowerCase()) ||
          n.content?.toLowerCase().includes(`[[${activeTitle.toLowerCase()}]]`))
    );
    setBacklinks(linksToActive);

    // -- Generate Force-Directed Graph Data --
    // We want the current node and all its first-degree connections
    const currentId = String(activeNode.id);
    const connectedTitles = new Set<string>();
    
    // Parse links from node properties or content
    (activeNode.links || []).forEach((l) => connectedTitles.add(l.toLowerCase()));
    
    const wikiLinkRegex = /\[\[([^\]]+)\]\]/g;
    let match;
    while ((match = wikiLinkRegex.exec(activeNode.content || '')) !== null) {
      connectedTitles.add(match[1].trim().toLowerCase());
    }

    // Also add backlinks to connected
    linksToActive.forEach((b) => connectedTitles.add(b.title.toLowerCase()));

    // Create the nodes list
    const tempNodes: GraphNode[] = [
      {
        id: currentId,
        label: activeNode.title,
        type: activeNode.type,
        x: 150,
        y: 150,
        vx: 0,
        vy: 0,
        isCurrent: true,
      },
    ];

    const tempLinks: GraphLink[] = [];

    // Find nodes corresponding to connected titles
    nodes.forEach((n) => {
      const isConnected = connectedTitles.has(n.title.toLowerCase());
      if (isConnected && String(n.id) !== currentId) {
        const nodeId = String(n.id);
        
        // Spawn nodes randomly in a circle around the center
        const angle = Math.random() * Math.PI * 2;
        const radius = 80;
        tempNodes.push({
          id: nodeId,
          label: n.title,
          type: n.type,
          x: 150 + Math.cos(angle) * radius,
          y: 150 + Math.sin(angle) * radius,
          vx: 0,
          vy: 0,
          isCurrent: false,
        });

        // Add visual links (bidirectional is fine, draw single link)
        tempLinks.push({
          source: currentId,
          target: nodeId,
        });
      }
    });

    setGraphNodes(tempNodes);
    setGraphLinks(tempLinks);
  }, [activeNode, nodes]);

  // Run force-directed layout physics simulation in pure React SVG loop
  useEffect(() => {
    if (graphNodes.length === 0) return;

    let localNodes = [...graphNodes];
    const width = 300;
    const height = 300;
    const center = { x: width / 2, y: height / 2 };

    const tick = () => {
      // 1. Repulsive forces between all nodes
      for (let i = 0; i < localNodes.length; i++) {
        const nodeA = localNodes[i];
        for (let j = i + 1; j < localNodes.length; j++) {
          const nodeB = localNodes[j];
          const dx = nodeB.x - nodeA.x;
          const dy = nodeB.y - nodeA.y;
          const distance = Math.sqrt(dx * dx + dy * dy) || 1;

          if (distance < 180) {
            const force = (180 - distance) * 0.08;
            const forceX = (dx / distance) * force;
            const forceY = (dy / distance) * force;

            if (!nodeA.isCurrent) {
              nodeA.vx -= forceX;
              nodeA.vy -= forceY;
            }
            if (!nodeB.isCurrent) {
              nodeB.vx += forceX;
              nodeB.vy += forceY;
            }
          }
        }
      }

      // 2. Attractive forces (links) pulling connected nodes to current node
      const current = localNodes.find((n) => n.isCurrent);
      if (current) {
        localNodes.forEach((node) => {
          if (node.isCurrent) return;

          const dx = current.x - node.x;
          const dy = current.y - node.y;
          const distance = Math.sqrt(dx * dx + dy * dy) || 1;
          const targetDist = 70; // Rest length of spring

          if (distance > targetDist) {
            const force = (distance - targetDist) * 0.05;
            node.vx += (dx / distance) * force;
            node.vy += (dy / distance) * force;
          }
        });
      }

      // 3. Gravity pulling nodes toward center
      localNodes.forEach((node) => {
        if (node.isCurrent) return;

        const dx = center.x - node.x;
        const dy = center.y - node.y;
        node.vx += dx * 0.01;
        node.vy += dy * 0.01;
      });

      // 4. Update positions, apply friction/damping
      localNodes = localNodes.map((n) => {
        if (dragRef.current.id === n.id) {
          return {
            ...n,
            x: dragRef.current.x,
            y: dragRef.current.y,
            vx: 0,
            vy: 0,
          };
        }
        if (n.isCurrent) return n; // Keep center node locked
        return {
          ...n,
          x: Math.max(20, Math.min(width - 20, n.x + n.vx)),
          y: Math.max(20, Math.min(height - 20, n.y + n.vy)),
          vx: n.vx * 0.7,
          vy: n.vy * 0.7,
        };
      });

      setGraphNodes(localNodes);
      animationFrameRef.current = requestAnimationFrame(tick);
    };

    animationFrameRef.current = requestAnimationFrame(tick);
    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [graphLinks]);

  // Mouse & wheel handlers for graph canvas pan/zoom/drag
  const handleSvgMouseDown = (e: React.MouseEvent<SVGSVGElement>) => {
    if (e.target === e.currentTarget || (e.target as SVGElement).tagName === 'svg') {
      setIsPanning(true);
      setPanStart({
        x: e.clientX - pan.x,
        y: e.clientY - pan.y,
      });
    }
  };

  const handleNodeMouseDown = (e: React.MouseEvent, nodeId: string) => {
    e.stopPropagation();
    setDraggedNodeId(nodeId);
    const node = graphNodes.find(n => n.id === nodeId);
    if (node) {
      dragRef.current = { id: nodeId, x: node.x, y: node.y };
    }
  };

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (draggedNodeId) {
      const rect = e.currentTarget.getBoundingClientRect();
      const clientX = e.clientX - rect.left;
      const clientY = e.clientY - rect.top;
      const newX = (clientX - pan.x) / zoom;
      const newY = (clientY - pan.y) / zoom;
      dragRef.current = { id: draggedNodeId, x: newX, y: newY };
    } else if (isPanning) {
      setPan({
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y,
      });
    }
  };

  const handleMouseUp = () => {
    setDraggedNodeId(null);
    setIsPanning(false);
    dragRef.current = { id: null, x: 0, y: 0 };
  };

  const handleWheel = (e: React.WheelEvent<SVGSVGElement>) => {
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const zoomFactor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
    const newZoom = Math.max(0.3, Math.min(4, zoom * zoomFactor));
    setPan({
      x: mouseX - (mouseX - pan.x) * (newZoom / zoom),
      y: mouseY - (mouseY - pan.y) * (newZoom / zoom),
    });
    setZoom(newZoom);
  };

  // Mouse & wheel handlers for modal graph canvas pan/zoom/drag
  const handleModalSvgMouseDown = (e: React.MouseEvent<SVGSVGElement>) => {
    if (e.target === e.currentTarget || (e.target as SVGElement).tagName === 'svg') {
      setIsModalPanning(true);
      setModalPanStart({
        x: e.clientX - modalPan.x,
        y: e.clientY - modalPan.y,
      });
    }
  };

  const handleModalMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (draggedNodeId) {
      const rect = e.currentTarget.getBoundingClientRect();
      const clientX = e.clientX - rect.left;
      const clientY = e.clientY - rect.top;
      const newX = (clientX - modalPan.x) / modalZoom;
      const newY = (clientY - modalPan.y) / modalZoom;
      dragRef.current = { id: draggedNodeId, x: newX, y: newY };
    } else if (isModalPanning) {
      setModalPan({
        x: e.clientX - modalPanStart.x,
        y: e.clientY - modalPanStart.y,
      });
    }
  };

  const handleModalMouseUp = () => {
    setDraggedNodeId(null);
    setIsModalPanning(false);
    dragRef.current = { id: null, x: 0, y: 0 };
  };

  const handleModalWheel = (e: React.WheelEvent<SVGSVGElement>) => {
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const zoomFactor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
    const newZoom = Math.max(0.3, Math.min(4, modalZoom * zoomFactor));
    setModalPan({
      x: mouseX - (mouseX - modalPan.x) * (newZoom / modalZoom),
      y: mouseY - (mouseY - modalPan.y) * (newZoom / modalZoom),
    });
    setModalZoom(newZoom);
  };

  // Handle Free Note Creation
  const handleCreateNote = async () => {
    if (!collection || !apiClient) return;
    const titleVal = prompt('Enter page title:');
    if (!titleVal || !titleVal.trim()) return;

    // Check duplicates
    if (nodes.some((n) => n.title.toLowerCase() === titleVal.trim().toLowerCase())) {
      message.warning('A note with this title already exists!');
      return;
    }

    setLoading(true);
    try {
      const cleanTitle = titleVal.trim();
      const slug = cleanTitle.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
      const uid = `note_${slug}_${Math.random().toString(36).slice(2, 6)}`;

      await apiClient.request({
        url: `/api/${collection}`,
        method: 'POST',
        data: {
          values: {
            uid,
            title: cleanTitle,
            type: 'note',
            content: `# ${cleanTitle}\n\nType your custom knowledge wiki here. You can reference other pages using [[Wiki Links]] syntax!`,
            links: [],
            backlinks: [],
          },
        },
      });

      message.success('Knowledge page created successfully!');
      await fetchNodes(cleanTitle);
    } catch (err) {
      console.error('[KnowledgeWiki] Create failed:', err);
      message.error('Failed to create page');
    } finally {
      setLoading(false);
    }
  };

  // Handle Note Save
  const handleSaveNote = async () => {
    if (!collection || !apiClient || !activeNode) return;
    setLoading(true);
    try {
      // Scan content for wiki links e.g. [[Acme Corp]]
      const linkRegex = /\[\[([^\]]+)\]\]/g;
      const extractedLinks: string[] = [];
      let match;
      while ((match = linkRegex.exec(editedContent)) !== null) {
        extractedLinks.push(match[1].trim());
      }

      await apiClient.request({
        url: `/api/${collection}/${activeNode.id}`,
        method: 'PUT',
        data: {
          values: {
            content: editedContent,
            links: [...new Set(extractedLinks)],
          },
        },
      });

      message.success('Knowledge base synchronized!');
      await fetchNodes(activeNode.title);
    } catch (err) {
      console.error('[KnowledgeWiki] Save failed:', err);
      message.error('Failed to save page');
    } finally {
      setLoading(false);
    }
  };

  // Navigate to clicked page link
  const navigateToPage = (title: string) => {
    const matched = nodes.find((n) => n.title.toLowerCase() === title.toLowerCase());
    if (matched) {
      setActiveNode(matched);
      setEditedContent(matched.content || '');
      setEditMode(false);
    } else {
      // If no page matches, ask to create it!
      const create = window.confirm(`No page exists named "${title}". Would you like to create it?`);
      if (create) {
        if (!collection || !apiClient) return;
        setLoading(true);
        const slug = title.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
        const uid = `note_${slug}_${Math.random().toString(36).slice(2, 6)}`;
        apiClient.request({
          url: `/api/${collection}`,
          method: 'POST',
          data: {
            values: {
              uid,
              title,
              type: 'note',
              content: `# ${title}\n\nThis page was automatically generated from a wiki link. Edit it to add content!`,
              links: [],
              backlinks: [],
            },
          },
        }).then(() => {
          fetchNodes(title);
        }).catch((err) => {
          console.error('[KnowledgeWiki] Create inline failed:', err);
        }).finally(() => setLoading(false));
      }
    }
  };

  // Simple Markdown Renderer that supports [[wiki-links]]
  const renderMarkdown = (text: string) => {
    if (!text) return <Paragraph style={{ color: '#8c8c8c', fontStyle: 'italic' }}>Empty content.</Paragraph>;

    const lines = text.split('\n');
    return lines.map((line, idx) => {
      // Handle Headings
      if (line.startsWith('# ')) {
        return <Title level={2} key={idx} style={{ marginTop: 16, marginBottom: 12 }}>{line.replace('# ', '')}</Title>;
      }
      if (line.startsWith('## ')) {
        return <Title level={3} key={idx} style={{ marginTop: 14, marginBottom: 10 }}>{line.replace('## ', '')}</Title>;
      }
      if (line.startsWith('### ')) {
        return <Title level={4} key={idx} style={{ marginTop: 12, marginBottom: 8 }}>{line.replace('### ', '')}</Title>;
      }
      if (line.startsWith('- ') || line.startsWith('* ')) {
        return <li key={idx} style={{ marginLeft: 16, fontSize: 13, marginBottom: 4 }}>{parseWikiLinks(line.substring(2))}</li>;
      }
      if (line.startsWith('> ')) {
        return (
          <blockquote key={idx} style={{ borderLeft: '4px solid #d9d9d9', paddingLeft: 12, color: '#595959', margin: '8px 0', fontStyle: 'italic' }}>
            {parseWikiLinks(line.substring(2))}
          </blockquote>
        );
      }
      if (line.trim() === '') {
        return <div key={idx} style={{ height: 12 }} />;
      }
      return <Paragraph key={idx} style={{ fontSize: 13, lineHeight: '1.6', marginBottom: 8 }}>{parseWikiLinks(line)}</Paragraph>;
    });
  };

  // Helper to parse [[wiki-links]] in lines
  const parseWikiLinks = (line: string) => {
    const parts = [];
    const regex = /\[\[([^\]]+)\]\]/g;
    let lastIndex = 0;
    let match;

    while ((match = regex.exec(line)) !== null) {
      const before = line.substring(lastIndex, match.index);
      if (before) parts.push(before);

      const linkText = match[1];
      const matchExists = nodes.some((n) => n.title.toLowerCase() === linkText.trim().toLowerCase());

      parts.push(
        <a
          key={match.index}
          href="#"
          onClick={(e) => {
            e.preventDefault();
            navigateToPage(linkText.trim());
          }}
          style={{
            fontWeight: 500,
            color: matchExists ? '#1677ff' : '#faad14', // yellow/orange if the target wiki node doesn't exist yet!
            borderBottom: '1px dashed',
            padding: '0 2px',
          }}
        >
          {linkText}
        </a>
      );
      lastIndex = regex.lastIndex;
    }

    const after = line.substring(lastIndex);
    if (after) parts.push(after);

    return parts.length > 0 ? parts : line;
  };

  // Filter nodes based on search query
  const filteredNodes = nodes.filter(
    (n) =>
      n.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      n.content?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <Layout
      style={{
        background: '#fff',
        border: '1px solid rgba(0,0,0,0.06)',
        borderRadius: 8,
        minHeight: 520,
        boxShadow: '0 4px 12px rgba(0,0,0,0.04)',
        overflow: 'hidden',
        ...style,
      }}
    >
      {/* 1. Left Sider: Note Tree & Search */}
      <Sider
        width={250}
        theme="light"
        style={{
          borderRight: '1px solid rgba(0,0,0,0.06)',
          background: '#f9fbfd',
          padding: 12,
        }}
      >
        <Space direction="vertical" size={12} style={{ width: '100%' }}>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            block
            onClick={handleCreateNote}
            style={{
              background: 'linear-gradient(135deg, #1677ff 0%, #1d39c4 100%)',
              border: 'none',
              boxShadow: '0 2px 6px rgba(22,119,255,0.3)',
            }}
          >
            Create Knowledge Page
          </Button>

          <Input
            placeholder="Search wiki..."
            prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ borderRadius: 6 }}
          />

          <Divider style={{ margin: '4px 0' }} />

          <List
            header={<Text strong style={{ fontSize: 11, color: '#8c8c8c', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Wikis & Entities</Text>}
            dataSource={filteredNodes}
            loading={loading && nodes.length === 0}
            size="small"
            style={{ maxHeight: 380, overflowY: 'auto' }}
            renderItem={(item) => {
              const isSelected = activeNode?.id === item.id;
              const typeColors: Record<string, string> = {
                entity: 'blue',
                activity: 'cyan',
                note: 'purple',
              };
              const tagColor = typeColors[item.type] || 'default';

              return (
                <List.Item
                  onClick={() => {
                    setActiveNode(item);
                    setEditedContent(item.content || '');
                    setEditMode(false);
                  }}
                  style={{
                    padding: '8px 10px',
                    borderRadius: 6,
                    cursor: 'pointer',
                    background: isSelected ? '#e6f4ff' : 'transparent',
                    border: 'none',
                    marginBottom: 4,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-start',
                    transition: 'all 0.2s',
                  }}
                  className="wiki-list-item"
                >
                  <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                    <Text
                      strong={isSelected}
                      style={{
                        fontSize: 13,
                        color: isSelected ? '#1677ff' : '#262626',
                        maxWidth: 160,
                        display: 'block',
                      }}
                      ellipsis
                    >
                      {item.title}
                    </Text>
                    <Tag color={tagColor} style={{ fontSize: 9, margin: 0, scale: '0.85' }}>
                      {item.type.substring(0, 4).toUpperCase()}
                    </Tag>
                  </Space>
                </List.Item>
              );
            }}
          />
        </Space>
      </Sider>

      {/* 2. Main Content Panel */}
      <Content style={{ padding: 16, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {activeNode ? (
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minWidth: 0 }}>
            {/* Header toolbar */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <Space>
                <Title level={4} style={{ margin: 0, fontWeight: 600 }}>{activeNode.title}</Title>
                <Tag color={activeNode.type === 'entity' ? 'blue' : activeNode.type === 'activity' ? 'cyan' : 'purple'}>
                  {activeNode.type.toUpperCase()}
                </Tag>
              </Space>

              <Space>
                <Button
                  size="small"
                  type={editMode ? 'default' : 'primary'}
                  icon={editMode ? <EyeOutlined /> : <EditOutlined />}
                  onClick={() => {
                    if (editMode) {
                      setEditMode(false);
                    } else {
                      setEditedContent(activeNode.content || '');
                      setEditMode(true);
                    }
                  }}
                >
                  {editMode ? 'Preview' : 'Edit Note'}
                </Button>
                {editMode && (
                  <Button size="small" type="primary" onClick={handleSaveNote} style={{ background: '#52c41a', borderColor: '#52c41a' }}>
                    Save Graph Node
                  </Button>
                )}
                <Button
                  size="small"
                  icon={<ShareAltOutlined />}
                  type={graphOpen ? 'primary' : 'default'}
                  onClick={() => setGraphOpen((v) => !v)}
                >
                  Graph Map
                </Button>
              </Space>
            </div>

            <Divider style={{ margin: '0 0 12px 0' }} />

            {/* Editor vs View layout */}
            <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
              {editMode ? (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                  <Input.TextArea
                    value={editedContent}
                    onChange={(e) => setEditedContent(e.target.value)}
                    style={{
                      flex: 1,
                      fontFamily: 'monospace',
                      fontSize: 13,
                      borderRadius: 6,
                      border: '1px solid #d9d9d9',
                      padding: 12,
                    }}
                    placeholder="# Enter markdown title..."
                  />
                  <Text type="secondary" style={{ fontSize: 11, marginTop: 4 }}>
                    💡 Pro Tip: Reference other nodes by writing <strong>[[Node Title]]</strong>, which creates dynamic local business relations!
                  </Text>
                </div>
              ) : (
                <div style={{ flex: 1, overflowY: 'auto', paddingRight: 8, background: '#fafafa', borderRadius: 6, border: '1px solid rgba(0,0,0,0.03)', padding: 16 }}>
                  {renderMarkdown(activeNode.content)}
                </div>
              )}
            </div>
          </div>
        ) : (
          <Empty description="No wiki pages configured. Click the button on the left to initialize the knowledge vault!" style={{ marginTop: 64 }} />
        )}
      </Content>

      {/* 3. Right Sider: Force-directed Graph Canvas & Backlinks */}
      {graphOpen && activeNode && (
        <Sider
          width={300}
          theme="light"
          style={{
            borderLeft: '1px solid rgba(0,0,0,0.06)',
            background: '#fafbfc',
            padding: 12,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <Space direction="vertical" size={16} style={{ width: '100%' }}>
            {/* SVG force-directed physics graph */}
            <Card
              size="small"
              title={<Space><ShareAltOutlined style={{ color: '#1677ff' }} />Relationship Graph Map</Space>}
              extra={
                <Tooltip title="Expand Graph View">
                  <Button
                    type="text"
                    size="small"
                    icon={<ExpandOutlined />}
                    onClick={() => {
                      setModalZoom(1.5);
                      setModalPan({ x: 250, y: 50 });
                      setIsModalOpen(true);
                    }}
                  />
                </Tooltip>
              }
              bodyStyle={{ padding: 4 }}
              style={{ borderRadius: 6, boxShadow: 'none', border: '1px solid rgba(0,0,0,0.06)' }}
            >
              <div style={{ position: 'relative', overflow: 'hidden' }}>
                <svg
                  width="100%"
                  height="250"
                  style={{
                    background: '#fff',
                    borderRadius: 4,
                    cursor: draggedNodeId ? 'grabbing' : isPanning ? 'grabbing' : 'grab',
                    userSelect: 'none'
                  }}
                  onMouseDown={handleSvgMouseDown}
                  onMouseMove={handleMouseMove}
                  onMouseUp={handleMouseUp}
                  onMouseLeave={handleMouseUp}
                  onWheel={handleWheel}
                >
                  <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
                    {/* Draw links */}
                    {graphLinks.map((link, idx) => {
                      const src = graphNodes.find((n) => n.id === link.source);
                      const tgt = graphNodes.find((n) => n.id === link.target);
                      if (!src || !tgt) return null;
                      return (
                        <line
                          key={idx}
                          x1={src.x}
                          y1={src.y}
                          x2={tgt.x}
                          y2={tgt.y}
                          stroke="#e8e8e8"
                          strokeWidth="2"
                          strokeDasharray="4 4"
                        />
                      );
                    })}

                    {/* Draw nodes */}
                    {graphNodes.map((node) => {
                      const isCore = node.isCurrent;
                      const nodeColor = isCore
                        ? '#1677ff'
                        : node.type === 'entity'
                        ? '#69c0ff'
                        : node.type === 'activity'
                        ? '#87e8de'
                        : '#b37feb';
                      const nodeRadius = isCore ? 14 : 9;

                      return (
                        <g
                          key={node.id}
                          style={{ cursor: draggedNodeId === node.id ? 'grabbing' : 'pointer' }}
                          onMouseDown={(e) => handleNodeMouseDown(e, node.id)}
                          onDoubleClick={() => {
                            const matched = nodes.find((n) => String(n.id) === node.id);
                            if (matched) {
                              setActiveNode(matched);
                              setEditedContent(matched.content || '');
                              setEditMode(false);
                            }
                          }}
                        >
                          <circle
                            cx={node.x}
                            cy={node.y}
                            r={nodeRadius}
                            fill={nodeColor}
                            stroke={isCore ? '#003eb3' : '#d9d9d9'}
                            strokeWidth={isCore ? 2.5 : 1}
                            style={{ transition: 'r 0.2s' }}
                          />
                          <text
                            x={node.x}
                            y={node.y - nodeRadius - 4}
                            textAnchor="middle"
                            style={{
                              fontSize: 10,
                              fill: isCore ? '#1f1f1f' : '#595959',
                              fontWeight: isCore ? 'bold' : 'normal',
                              pointerEvents: 'none',
                            }}
                          >
                            {node.label.length > 10 ? node.label.substring(0, 9) + '...' : node.label}
                          </text>
                        </g>
                      );
                    })}
                  </g>
                </svg>

                {/* Reset button inside the canvas */}
                <Button
                  size="small"
                  style={{
                    position: 'absolute',
                    right: 8,
                    bottom: 8,
                    fontSize: 10,
                    background: 'rgba(255, 255, 255, 0.85)',
                    borderRadius: 4,
                    border: '1px solid rgba(0,0,0,0.1)',
                  }}
                  onClick={() => {
                    setZoom(1);
                    setPan({ x: 0, y: 0 });
                  }}
                >
                  Reset View
                </Button>
              </div>
              <Text type="secondary" style={{ fontSize: 9, paddingLeft: 8, display: 'block', paddingBottom: 4 }}>
                💡 Tip: Drag node to move. Drag background to pan. Scroll to zoom. Double-click node to focus.
              </Text>
            </Card>

            {/* Modal for Expanded Graph Map */}
            <Modal
              title={
                <Space>
                  <ShareAltOutlined style={{ color: '#1677ff' }} />
                  <span>Relationship Graph Map (Expanded View)</span>
                </Space>
              }
              open={isModalOpen}
              onCancel={() => setIsModalOpen(false)}
              width={1000}
              footer={null}
              styles={{ body: { padding: 8 } }}
            >
              <div style={{ position: 'relative', overflow: 'hidden', border: '1px solid rgba(0,0,0,0.06)', borderRadius: 8 }}>
                <svg
                  width="100%"
                  height="550"
                  style={{
                    background: '#fff',
                    cursor: draggedNodeId ? 'grabbing' : isModalPanning ? 'grabbing' : 'grab',
                    userSelect: 'none'
                  }}
                  onMouseDown={handleModalSvgMouseDown}
                  onMouseMove={handleModalMouseMove}
                  onMouseUp={handleModalMouseUp}
                  onMouseLeave={handleModalMouseUp}
                  onWheel={handleModalWheel}
                >
                  <g transform={`translate(${modalPan.x}, ${modalPan.y}) scale(${modalZoom})`}>
                    {/* Draw links */}
                    {graphLinks.map((link, idx) => {
                      const src = graphNodes.find((n) => n.id === link.source);
                      const tgt = graphNodes.find((n) => n.id === link.target);
                      if (!src || !tgt) return null;
                      return (
                        <line
                          key={idx}
                          x1={src.x}
                          y1={src.y}
                          x2={tgt.x}
                          y2={tgt.y}
                          stroke="#e8e8e8"
                          strokeWidth="2"
                          strokeDasharray="4 4"
                        />
                      );
                    })}

                    {/* Draw nodes */}
                    {graphNodes.map((node) => {
                      const isCore = node.isCurrent;
                      const nodeColor = isCore
                        ? '#1677ff'
                        : node.type === 'entity'
                        ? '#69c0ff'
                        : node.type === 'activity'
                        ? '#87e8de'
                        : '#b37feb';
                      const nodeRadius = isCore ? 14 : 9;

                      return (
                        <g
                          key={node.id}
                          style={{ cursor: draggedNodeId === node.id ? 'grabbing' : 'pointer' }}
                          onMouseDown={(e) => handleNodeMouseDown(e, node.id)}
                          onDoubleClick={() => {
                            const matched = nodes.find((n) => String(n.id) === node.id);
                            if (matched) {
                              setActiveNode(matched);
                              setEditedContent(matched.content || '');
                              setEditMode(false);
                              setIsModalOpen(false);
                            }
                          }}
                        >
                          <circle
                            cx={node.x}
                            cy={node.y}
                            r={nodeRadius}
                            fill={nodeColor}
                            stroke={isCore ? '#003eb3' : '#d9d9d9'}
                            strokeWidth={isCore ? 2.5 : 1}
                          />
                          <text
                            x={node.x}
                            y={node.y - nodeRadius - 4}
                            textAnchor="middle"
                            style={{
                              fontSize: 10,
                              fill: isCore ? '#1f1f1f' : '#595959',
                              fontWeight: isCore ? 'bold' : 'normal',
                              pointerEvents: 'none',
                            }}
                          >
                            {node.label}
                          </text>
                        </g>
                      );
                    })}
                  </g>
                </svg>

                {/* Reset button inside the modal canvas */}
                <Button
                  size="small"
                  style={{
                    position: 'absolute',
                    right: 8,
                    bottom: 8,
                    fontSize: 10,
                    background: 'rgba(255, 255, 255, 0.85)',
                    borderRadius: 4,
                    border: '1px solid rgba(0,0,0,0.1)',
                  }}
                  onClick={() => {
                    setModalZoom(1.5);
                    setModalPan({ x: 250, y: 50 });
                  }}
                >
                  Reset View
                </Button>
              </div>
              <div style={{ marginTop: 8, fontSize: 11, color: '#8c8c8c', textAlign: 'center' }}>
                💡 Tip: Drag node to move. Drag background to pan. Scroll to zoom. Double-click node to focus and close.
              </div>
            </Modal>

            {/* Backlinks Panel */}
            <Card
              size="small"
              title={<Space><LinkOutlined style={{ color: '#b37feb' }} />Backlinks referencing here</Space>}
              bodyStyle={{ padding: 4 }}
              style={{ borderRadius: 6, boxShadow: 'none', border: '1px solid rgba(0,0,0,0.06)' }}
            >
              {backlinks.length > 0 ? (
                <List
                  size="small"
                  dataSource={backlinks}
                  renderItem={(item) => (
                    <List.Item
                      onClick={() => {
                        setActiveNode(item);
                        setEditedContent(item.content || '');
                        setEditMode(false);
                      }}
                      style={{
                        padding: '6px 8px',
                        cursor: 'pointer',
                        borderRadius: 4,
                        marginBottom: 2,
                        fontSize: 12,
                        border: 'none',
                      }}
                      className="backlink-item"
                    >
                      <Space>
                        <FileTextOutlined style={{ color: '#8c8c8c' }} />
                        <Text strong style={{ fontSize: 12 }}>{item.title}</Text>
                      </Space>
                    </List.Item>
                  )}
                />
              ) : (
                <div style={{ textAlign: 'center', padding: '12px 0', color: '#bfbfbf', fontSize: 11 }}>
                  No backlinks reference this page.
                </div>
              )}
            </Card>
          </Space>
        </Sider>
      )}
    </Layout>
  );
};

export default KnowledgeWiki;
