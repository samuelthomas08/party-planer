import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import './Places.sass';
import { faPlus } from '@fortawesome/free-solid-svg-icons';
import { useEffect, useState } from 'react';
import Place from './Place/Place';
import { Link } from 'react-router-dom';
import { collection, getDocs, query } from 'firebase/firestore';
import { db } from '../../firebase/firebase';

const Places = () => {

    const [placeList, setPlaceList] = useState([]);

    useEffect(() => {
        const fetchData = async () => {
            const q = query(collection(db, "places"));

            const querySnapshot = await getDocs(q);

            const data = querySnapshot.docs.map(el => ({ id: el.id, ...el.data() }));
            setPlaceList(data);
        }

        fetchData();
    }, []);

    return (
        <div className="Places">
            <div>
                <h1>Party-Orte</h1>

                <div className="places">
                    {placeList.length == 0 ? <p>Du hast noch keine Orte eingespeichert...</p> : placeList.map(place => <Place placeList={placeList} setPlaceList={setPlaceList} title={place.name} placeId={place.nameId} />)}
                </div>
            </div>

            <Link to='/new-place'><button className="create-new-place-btn"><FontAwesomeIcon icon={faPlus} /> Neuen Ort erstellen</button></Link>
        </div>
    );
}

export default Places;