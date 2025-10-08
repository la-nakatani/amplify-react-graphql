import React, { useState, useEffect } from "react";
import "./App.css";
import { API, Storage } from "aws-amplify";
import { withAuthenticator, AmplifySignOut } from "@aws-amplify/ui-react";
import { listNotes } from "./graphql/queries";
import {
  createNote as createNoteMutation,
  deleteNote as deleteNoteMutation,
} from "./graphql/mutations";

const initialFormState = { name: "", description: "", image: "" };

function App() {
  const [notes, setNotes] = useState([]);
  const [formData, setFormData] = useState(initialFormState);

  useEffect(() => {
    fetchNotes();
  }, []);

  // ✅ 画像も含めてメモを取得するよう修正
  async function fetchNotes() {
    const apiData = await API.graphql({ query: listNotes });
    const notesFromAPI = apiData.data.listNotes.items;

    // ✅ 画像があるメモにはS3から画像URLを取得
    await Promise.all(
      notesFromAPI.map(async (note) => {
        if (note.image) {
          const image = await Storage.get(note.image);
          note.image = image;
        }
        return note;
      })
    );

    setNotes(notesFromAPI);
  }

  // ✅ 画像付きメモの作成に対応
  async function createNote() {
    if (!formData.name || !formData.description) return;

    try {
      // サーバーに作成依頼をして、作成されたノートのデータを受け取る
      const newNoteData = await API.graphql({
        query: createNoteMutation,
        variables: { input: formData },
      });

      const note = newNoteData.data.createNote; // 作成されたノート情報

      // 画像があればStorageからURLを取得してセット
      if (formData.image) {
        const image = await Storage.get(formData.image);
        note.image = image;
      }

      // notes配列に作成されたノートを追加
      setNotes([...notes, note]);

      // フォームを初期化
      setFormData(initialFormState);
    } catch (err) {
      console.error("Error creating note:", JSON.stringify(err, null, 2));
    }
  }

  async function deleteNote({ id }) {
    const newNotesArray = notes.filter((note) => note.id !== id);
    setNotes(newNotesArray);
    await API.graphql({
      query: deleteNoteMutation,
      variables: { input: { id } },
    });
  }

  // ✅ 画像ファイル選択時の処理（Storageにアップロード）
  async function onChange(e) {
    if (!e.target.files[0]) return;
    const file = e.target.files[0];
    setFormData({ ...formData, image: file.name });
    await Storage.put(file.name, file);
    fetchNotes();
  }

  return (
    <div className="App">
      <h1>My Notes App</h1>

      <input
        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
        placeholder="Note name"
        value={formData.name}
      />
      <input
        onChange={(e) =>
          setFormData({ ...formData, description: e.target.value })
        }
        placeholder="Note description"
        value={formData.description}
      />

      {/* ✅ 画像ファイル入力フォームを追加 */}
      <input type="file" onChange={onChange} />

      <button onClick={createNote}>Create Note</button>

      <div style={{ marginBottom: 30 }}>
        {notes.map((note) => (
          <div key={note.id || note.name}>
            <h2>{note.name}</h2>
            <p>{note.description}</p>
            <button onClick={() => deleteNote(note)}>Delete note</button>

            {/* ✅ 画像がある場合は表示 */}
            {note.image && (
              <img src={note.image} alt="note" style={{ width: 400 }} />
            )}
          </div>
        ))}
      </div>

      <AmplifySignOut />
    </div>
  );
}

export default withAuthenticator(App);
