import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import './Places.sass';
import {
    faPlus, faFolderPlus, faTrashAlt, faEdit,
    faArrowsRotate
} from '@fortawesome/free-solid-svg-icons';
import { useEffect, useRef, useState } from 'react';
import Place from './Place/Place';
import { Link } from 'react-router-dom';
import {
    collection, deleteDoc, doc, getDoc, onSnapshot, setDoc
} from 'firebase/firestore';
import { db } from '../../firebase/firebase';
import { uid } from 'uid';

const Places = () => {
    const [placeList, setPlaceList] = useState([]);
    const [placeFolders, setPlaceFolders] = useState([]);
    const [newFolderModalStatus, setNewFolderModalStatus] = useState(false);
    const [renameFolderModalStatus, setRenameFolderModalStatus] = useState(false);

    const newFolderNameRef = useRef('');
    const renameFolderNameRef = useRef('');
    const [renamingFolderId, setRenamingFolderId] = useState('');

    // Firestore Live-Updates für Orte & Ordner
    useEffect(() => {
        const unsubscribePlaces = onSnapshot(collection(db, "places"), (snapshot) => {
            const placeListData = snapshot.docs.map(el => ({ id: el.id, ...el.data() }));
            setPlaceList(placeListData);
        });

        const unsubscribeFolders = onSnapshot(collection(db, "place-folders"), (snapshot) => {
            const placeFoldersData = snapshot.docs.map(el => ({ id: el.id, ...el.data() }));
            setPlaceFolders(placeFoldersData);
        });

        renameFolderNameRef.current.focus();

        return () => {
            unsubscribePlaces();
            unsubscribeFolders();
        };
    }, []);

    const showNewFolderModal = () => {
        setNewFolderModalStatus(true);
    }

    const showRenameFolderModal = (name, id) => {
        setRenameFolderModalStatus(true);
        setRenamingFolderId(id);

        if (renameFolderNameRef.current) {
            renameFolderNameRef.current.value = name;
            
        }
    }

    const createNewFolder = (e) => {
        e.preventDefault();

        let folderId = newFolderNameRef.current.value.toLowerCase()
            .replace('ä', 'ae')
            .replace('ö', 'oe')
            .replace('ü', 'ue')
            .replace(' ', '_') + uid(12);

        const folderData = {
            id: folderId,
            name: newFolderNameRef.current.value,
            places: []
        }

        setDoc(doc(db, 'place-folders', folderId), folderData);

        newFolderNameRef.current.value = '';
        setNewFolderModalStatus(false);
    }

    const renameFolder = async (e) => {
        e.preventDefault();

        const folderRef = doc(db, 'place-folders', renamingFolderId);
        const folderSnap = await getDoc(folderRef);

        if (folderSnap.exists()) {
            const folderData = {
                id: renamingFolderId,
                name: renameFolderNameRef.current.value,
                places: folderSnap.data().places
            }

            setDoc(folderRef, folderData);
            setRenameFolderModalStatus(false);
        }
    }

    const deleteFolder = (name, id, places) => {
        const confirmDelete = window.confirm(`Willst du wirklich "${name}" (enthält ${places.length} Ort${places.length > 1 ? 'e' : ''}) löschen?`);

        if(confirmDelete) {
            places.forEach(placeId => {
                deleteDoc(doc(db, 'places', placeId));
            });

            deleteDoc(doc(db, 'place-folders', id));
        }
    }

    return (
        <div className="Places">
            <div>
                <div className="places-section-heading">
                    <h1>Party-Orte</h1>
                    <FontAwesomeIcon className="new-folder" icon={faFolderPlus} onClick={showNewFolderModal} />
                </div>

                <div className={newFolderModalStatus ? "new-folder-modal" : "new-folder-modal-invisible"}>
                    <form>
                        <p>Name des Ordners</p>
                        <div>
                            <input autoFocus type="text" ref={newFolderNameRef} />
                            <button type="submit" className="new-folder-btn" onClick={createNewFolder}>
                                <FontAwesomeIcon icon={faPlus} className='new-folder-btn-icon' />
                            </button>
                        </div>
                    </form>
                </div>

                <div className={renameFolderModalStatus ? "rename-folder-modal" : "rename-folder-modal-invisible"}>
                    <form>
                        <p>Ordner umbenennen</p>
                        <div>
                            <input autoFocus type="text" ref={renameFolderNameRef} />
                            <button type="submit" className="rename-folder-btn" onClick={renameFolder}>
                                <FontAwesomeIcon icon={faArrowsRotate} className='rename-folder-btn-icon' />
                            </button>
                        </div>
                    </form>
                </div>

                <div className="places">
                    {placeList.length === 0 ? (
                        <p>Du hast noch keine Orte eingespeichert...</p>
                    ) : (
                        placeFolders.map((placeFolder, index) => (
                            <div className='folder' key={index}>
                                <div className='folder-heading-container'>
                                    <h2 className='folder-heading'>{placeFolder.name}</h2>
                                    <FontAwesomeIcon className='icon' icon={faEdit} onClick={() => showRenameFolderModal(placeFolder.name, placeFolder.id)} />
                                    <FontAwesomeIcon className='icon' icon={faTrashAlt} onClick={() => deleteFolder(placeFolder.name, placeFolder.id, placeFolder.places)} />
                                </div>
                                {placeFolder.places.length === 0 ? <p>Hier sind noch keine Orte</p> : placeFolder.places.map(place => {
                                    const fetchedPlace = placeList.find(p => p.nameId === place);
                                    if (!fetchedPlace) return null;
                                    return (
                                        <Place
                                            key={fetchedPlace.nameId}
                                            placeList={placeList}
                                            setPlaceList={setPlaceList}
                                            title={fetchedPlace.name}
                                            placeId={fetchedPlace.nameId}
                                        />
                                    );
                                })}
                            </div>
                        ))
                    )}
                </div>
            </div>

            <Link to='/new-place'>
                <button className="create-new-place-btn">
                    <FontAwesomeIcon icon={faPlus} /> Neuen Ort erstellen
                </button>
            </Link>
        </div>
    );
}

export default Places;
