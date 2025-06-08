import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import './Places.sass';
import { faPlus, faFolderPlus } from '@fortawesome/free-solid-svg-icons';
import { useEffect, useRef, useState } from 'react';
import Place from './Place/Place';
import { Link } from 'react-router-dom';
import { collection, doc, getDocs, query, setDoc } from 'firebase/firestore';
import { db } from '../../firebase/firebase';
import { uid } from 'uid';

const Places = () => {

    const [placeList, setPlaceList] = useState([]);
    const [placeFolders, setPlaceFolders] = useState([]);
    const [newFolderModalStatus, setNewFolderModalStatus] = useState(false);

    const newFolderNameRef = useRef('');

    useEffect(() => {
        const fetchData = async () => {
            // Fetch all stored places
            const placeListQuery = query(collection(db, "places"));
            const placeListQuerySnapshot = await getDocs(placeListQuery);

            const placeListData = placeListQuerySnapshot.docs.map(el => ({ id: el.id, ...el.data() }));
            setPlaceList(placeListData);

            // Fetch all stored folders for places
            const placeFoldersQuery = query(collection(db, "place-folders"));
            const placeFoldersQuerySnapshot = await getDocs(placeFoldersQuery);

            const placeFoldersData = placeFoldersQuerySnapshot.docs.map(el => ({ id: el.id, ...el.data() }));
            setPlaceFolders(placeFoldersData);
        }

        fetchData();
    }, []);

    const showNewFolderModal = () => {
        setNewFolderModalStatus(true)
    }
    
    const createNewFolder = (e) => {
        e.preventDefault();

        let folderId = newFolderNameRef.current.value.toLowerCase();
        folderId = folderId.replace('ä', 'ae');
        folderId = folderId.replace('ö', 'oe');
        folderId = folderId.replace('ü', 'ue');
        folderId = folderId.replace(' ', '_');
        folderId = folderId + uid(12);

        const folderData = {
            id: folderId,
            name: newFolderNameRef.current.value,
            places: []
        }
        
        setDoc(doc(db, 'place-folders', folderId), folderData);


        newFolderNameRef.current.value = '';
        setNewFolderModalStatus(false);
    }

    return (
        <div className="Places">

            <div>
                
                <div className="places-section-heading">
                    <h1>Party-Orte</h1>
                    <FontAwesomeIcon className="new-folder" icon={faFolderPlus} onClick={showNewFolderModal} />
                </div>
                {newFolderModalStatus ? <div className="new-folder-modal">
                    <form>
                        <p>Name des Ordners</p>
                        <div>
                            <input autoFocus type="text" ref={newFolderNameRef} />   
                            <button type="submit" className="new-folder-btn" onClick={e => createNewFolder(e)}>
                                <FontAwesomeIcon icon={faPlus} className='new-folder-btn-icon' />
                            </button>
                        </div>

                    </form>
                </div> : null}
                
                <div className="places">
                    {placeList.length === 0 ? (
                        <p>Du hast noch keine Orte eingespeichert...</p>
                    ) : (
                        placeFolders.map((placeFolder, index) => (
                            <div className='folder' key={index}>
                                <h2 className='folder-heading'>{placeFolder.name}</h2>
                                {placeFolder.places.map(place => {
                                    const fetchedPlace = placeList.find(id => id.nameId === place);
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

            <Link to='/new-place'><button className="create-new-place-btn"><FontAwesomeIcon icon={faPlus} /> Neuen Ort erstellen</button></Link>
        </div>
    );
}

export default Places;