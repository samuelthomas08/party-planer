import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import './Place.sass';
import { faEdit, faShareFromSquare, faTrashCan } from '@fortawesome/free-solid-svg-icons';
import { useNavigate } from 'react-router-dom';
import { deleteDoc, doc } from 'firebase/firestore';
import { db } from '../../../firebase/firebase';

const Place = ({ title, placeId, placeList, setPlaceList }) => {
    
    const navigate = useNavigate();

    const deletePlaceHandler = async () => {
        await deleteDoc(doc(db, "places", placeId));

        setPlaceList(placeList.filter(place => place.id !== placeId));
    }

    return (
        <div className="Place">
            <h1>{title}</h1>

            <div className="right">
                <FontAwesomeIcon onClick={() => navigate('/place/' + placeId)} className='icon' icon={faShareFromSquare} />

                <FontAwesomeIcon onClick={deletePlaceHandler} className='icon delete' icon={faTrashCan} />
            </div>
        </div>
    );
}

export default Place;